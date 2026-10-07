import { beforeEach, describe, expect, it, vi } from "vitest";

import { campusDateTimeInputValue, campusDateTimeToIso } from "@/lib/format";

import { assignAssetSchema, requestAssetSchema } from "./schema";
import { isOverdue } from "./status";

const BUILDING = "6f1c7a8e-2b1d-4c1e-9a3f-1d2e3f4a5b6c";
const ROOM = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const ASSET = "11111111-2222-4333-8444-555555555555";
// 29 Sep 2026, 12:00 campus time (06:30 UTC).
const NOW = new Date("2026-09-29T06:30:00Z");

// --- Campus time -----------------------------------------------------------------

describe("campus date-time conversion", () => {
  it("reads_picker_values_as_campus_time", () => {
    expect(campusDateTimeToIso("2026-10-01T14:30")).toBe(
      "2026-10-01T09:00:00.000Z",
    );
  });

  it("rejects_malformed_values", () => {
    expect(campusDateTimeToIso("2026-10-01")).toBeNull();
    expect(campusDateTimeToIso("tomorrow")).toBeNull();
  });

  it("formats_now_for_the_picker_minimum", () => {
    expect(campusDateTimeInputValue(NOW)).toBe("2026-09-29T12:00");
  });
});

describe("requestAssetSchema", () => {
  const base = {
    buildingId: BUILDING,
    roomId: ROOM,
    expectedReturn: "",
    notes: "",
  };

  it("accepts_a_request_without_a_return_time", () => {
    expect(requestAssetSchema(NOW).parse(base)).toEqual({
      buildingId: BUILDING,
      roomId: ROOM,
      expectedReturn: null,
      notes: null,
    });
  });

  it("converts_the_expected_return_to_utc", () => {
    const parsed = requestAssetSchema(NOW).parse({
      ...base,
      expectedReturn: "2026-09-29T17:00",
    });
    expect(parsed.expectedReturn).toBe("2026-09-29T11:30:00.000Z");
  });

  it.each([
    ["2026-09-29T11:59", "Expected return must be in the future."],
    ["2027-10-01T10:00", "Expected return must be within a year."],
    ["not a date", "Enter a valid date and time."],
  ])("rejects_expected_return_%s", (expectedReturn, message) => {
    const result = requestAssetSchema(NOW).safeParse({
      ...base,
      expectedReturn,
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["expectedReturn"],
      message,
    });
  });

  it("requires_a_building_and_room", () => {
    const result = requestAssetSchema(NOW).safeParse({
      ...base,
      buildingId: "",
      roomId: "",
    });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual([
      "buildingId",
      "roomId",
    ]);
  });
});

describe("assignAssetSchema", () => {
  const base = {
    userEmail: "  Priya@Example.EDU ",
    buildingId: BUILDING,
    roomId: ROOM,
    expectedReturn: "",
    notes: "",
  };

  it("normalises_the_recipient_email", () => {
    expect(assignAssetSchema(NOW).parse(base).userEmail).toBe(
      "priya@example.edu",
    );
  });

  it.each([
    ["", "Enter the email address of the person receiving the asset."],
    ["priya", "Enter a valid email address."],
  ])("rejects_recipient_%j", (userEmail, message) => {
    const result = assignAssetSchema(NOW).safeParse({ ...base, userEmail });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["userEmail"],
      message,
    });
  });

  it("keeps_the_request_rules", () => {
    const result = assignAssetSchema(NOW).safeParse({
      ...base,
      roomId: "",
      expectedReturn: "2026-09-29T11:00",
    });
    expect(result.error?.issues.map((i) => i.path[0])).toEqual([
      "roomId",
      "expectedReturn",
    ]);
  });
});

describe("isOverdue", () => {
  it("is_true_only_for_active_assignments_past_their_return_time", () => {
    expect(isOverdue("ACTIVE", "2026-09-28T00:00:00Z", NOW)).toBe(true);
    expect(isOverdue("ACTIVE", "2026-09-30T00:00:00Z", NOW)).toBe(false);
    expect(isOverdue("ACTIVE", null, NOW)).toBe(false);
    expect(isOverdue("RETURNED", "2026-09-28T00:00:00Z", NOW)).toBe(false);
  });
});

// --- Server Action ---------------------------------------------------------------

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  }),
}));

const requireUser = vi.fn();
const requireRole = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: () => requireUser(),
  requireRole: (roles: string[]) => requireRole(roles),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

const findUserByEmail = vi.fn();
vi.mock("./queries", () => ({
  findUserByEmail: (email: string) => findUserByEmail(email),
}));

const { assignAsset, requestAsset, returnAsset } = await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const idle = { status: "idle" } as const;
const valid = {
  buildingId: BUILDING,
  roomId: ROOM,
  expectedReturn: "",
  notes: "Lecture",
};

describe("requestAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "student-1", role: "STUDENT" });
    rpc.mockResolvedValue({ data: "assignment-1", error: null });
  });

  it("calls_the_workflow_function_without_any_user_id_and_redirects", async () => {
    await expect(
      requestAsset(
        ASSET,
        "AST-2026-00001",
        idle,
        form({ ...valid, userId: "someone-else" }),
      ),
    ).rejects.toMatchObject({
      path: "/assets/AST-2026-00001?toast=asset-requested",
    });

    expect(rpc).toHaveBeenCalledWith("request_asset", {
      p_asset_id: ASSET,
      p_usage_building_id: BUILDING,
      p_usage_room_id: ROOM,
      p_expected_return_at: null,
      p_notes: "Lecture",
    });
  });

  it("requires_a_signed_in_user", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      requestAsset(ASSET, "AST-2026-00001", idle, form(valid)),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["CA001", { message: "This asset is no longer available." }],
    [
      "CA002",
      {
        fieldErrors: {
          roomId: [
            "The selected room does not belong to the selected building, or is not in use.",
          ],
        },
      },
    ],
    [
      "CA003",
      {
        fieldErrors: {
          expectedReturn: [
            "Expected return must be in the future and within a year.",
          ],
        },
      },
    ],
    ["42501", { message: "Your account cannot request assets." }],
    ["P0002", { message: "This asset no longer exists." }],
  ])("maps_database_error_%s", async (code, expected) => {
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: "internal detail" },
    });
    const state = await requestAsset(
      ASSET,
      "AST-2026-00001",
      idle,
      form(valid),
    );
    expect(state).toMatchObject({ status: "error", ...expected });
    expect(JSON.stringify(state)).not.toContain("internal detail");
  });

  it("rejects_malformed_ids_without_calling_the_database", async () => {
    const state = await requestAsset(
      "nope",
      "AST-2026-00001",
      idle,
      form(valid),
    );
    expect(state.message).toBe("This asset no longer exists.");
    expect(rpc).not.toHaveBeenCalled();
  });
});

const ASSIGNMENT = "22222222-3333-4444-8555-666666666666";
const RECIPIENT = "33333333-4444-4555-8666-777777777777";

describe("returnAsset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "student-1", role: "STUDENT" });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("calls_the_workflow_function_with_only_the_assignment", async () => {
    const state = await returnAsset(ASSIGNMENT, "AST-2026-00001");
    expect(state.status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("return_asset", {
      p_assignment_id: ASSIGNMENT,
    });
  });

  it.each([
    ["42501", "You can only return assets assigned to you."],
    ["CA004", "This asset has already been returned."],
    ["P0002", "This assignment no longer exists."],
    ["XX000", "Unable to return the asset. Please try again."],
  ])("maps_database_error_%s", async (code, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: "internal detail" },
    });
    const state = await returnAsset(ASSIGNMENT, "AST-2026-00001");
    expect(state).toEqual({ status: "error", message });
  });

  it("rejects_malformed_ids_without_calling_the_database", async () => {
    expect((await returnAsset("nope", "AST-2026-00001")).status).toBe("error");
    expect((await returnAsset(ASSIGNMENT, "../admin")).status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("assignAsset", () => {
  const assignForm = { ...valid, userEmail: "Priya@Example.edu" };

  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    findUserByEmail.mockResolvedValue({
      id: RECIPIENT,
      full_name: "Priya",
      is_active: true,
    });
    rpc.mockResolvedValue({ data: "assignment-2", error: null });
  });

  it("is_admin_only", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      assignAsset(ASSET, "AST-2026-00001", null, idle, form(assignForm)),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("assigns_an_available_asset_to_the_user_with_that_email", async () => {
    await expect(
      assignAsset(ASSET, "AST-2026-00001", null, idle, form(assignForm)),
    ).rejects.toMatchObject({
      path: "/assets/AST-2026-00001?toast=asset-assigned",
    });
    expect(findUserByEmail).toHaveBeenCalledWith("priya@example.edu");
    expect(rpc).toHaveBeenCalledWith("assign_asset", {
      p_asset_id: ASSET,
      p_user_id: RECIPIENT,
      p_usage_building_id: BUILDING,
      p_usage_room_id: ROOM,
      p_expected_return_at: null,
      p_notes: "Lecture",
    });
  });

  it("transfers_the_assignment_the_admin_was_looking_at", async () => {
    await expect(
      assignAsset(ASSET, "AST-2026-00001", ASSIGNMENT, idle, form(assignForm)),
    ).rejects.toMatchObject({
      path: "/assets/AST-2026-00001?toast=asset-transferred",
    });
    expect(rpc).toHaveBeenCalledWith("transfer_asset", {
      p_assignment_id: ASSIGNMENT,
      p_to_user_id: RECIPIENT,
      p_usage_building_id: BUILDING,
      p_usage_room_id: ROOM,
      p_expected_return_at: null,
      p_notes: "Lecture",
    });
  });

  it.each([
    [null, "No user has this email address."],
    [
      { id: RECIPIENT, full_name: "Priya", is_active: false },
      "This person's account is not active.",
    ],
  ])("explains_an_unusable_recipient", async (user, message) => {
    findUserByEmail.mockResolvedValue(user);
    const state = await assignAsset(
      ASSET,
      "AST-2026-00001",
      null,
      idle,
      form(assignForm),
    );
    expect(state).toMatchObject({
      status: "error",
      fieldErrors: { userEmail: [message] },
      values: { userEmail: "Priya@Example.edu" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["CA001", null, { message: "This asset is no longer available." }],
    [
      "CA004",
      ASSIGNMENT,
      { message: expect.stringContaining("assignment has changed") },
    ],
    [
      "CA005",
      null,
      { fieldErrors: { userEmail: ["This person's account is not active."] } },
    ],
  ])("maps_database_error_%s", async (code, current, expected) => {
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: "internal detail" },
    });
    const state = await assignAsset(
      ASSET,
      "AST-2026-00001",
      current,
      idle,
      form(assignForm),
    );
    expect(state).toMatchObject({ status: "error", ...expected });
    expect(JSON.stringify(state)).not.toContain("internal detail");
  });
});
