import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolutionAssetStates,
  resolvedMessage,
  unchangedAssetExplanation,
} from "./resolution";
import {
  assignTechnicianSchema,
  cancelSchema,
  hasMaintenanceFilters,
  isRequestNumberSearch,
  maintenanceListQuery,
  parseMaintenanceListParams,
  reportProblemSchema,
  requestNumberParam,
  resolveSchema,
  workNoteSchema,
} from "./schema";

const ASSET = "11111111-2222-4333-8444-555555555555";
const REQUEST = "22222222-3333-4444-8555-666666666666";
const TECHNICIAN = "33333333-4444-4555-8666-777777777777";

describe("reportProblemSchema", () => {
  it("trims_the_description_and_accepts_a_priority", () => {
    expect(
      reportProblemSchema.parse({
        description: "  No image  ",
        priority: "HIGH",
      }),
    ).toEqual({ description: "No image", priority: "HIGH" });
  });

  it("requires_a_description_and_a_known_priority", () => {
    const result = reportProblemSchema.safeParse({
      description: "   ",
      priority: "URGENT",
    });
    expect(
      result.error?.issues.map((issue) => [issue.path[0], issue.message]),
    ).toEqual([
      ["description", "Describe the problem."],
      ["priority", "Choose how serious the problem is."],
    ]);
  });

  it("limits_the_description_to_what_the_database_accepts", () => {
    const result = reportProblemSchema.safeParse({
      description: "x".repeat(2001),
      priority: "LOW",
    });
    expect(result.success).toBe(false);
  });
});

describe("maintenance list params", () => {
  const NONE = parseMaintenanceListParams({});

  it("keeps_valid_filters_and_drops_invalid_ones", () => {
    expect(
      parseMaintenanceListParams({
        search: " MR-2026-0017 ",
        status: "IN_PROGRESS",
        priority: "SOON",
        technician: "not-a-user",
        from: "2026-02-30",
        sort: "random",
        page: "3",
      }),
    ).toEqual({
      search: "MR-2026-0017",
      status: "IN_PROGRESS",
      priority: null,
      technician: null,
      from: null,
      to: null,
      sort: null,
      page: 3,
    });
    expect(parseMaintenanceListParams({ page: "-1" }).page).toBe(1);
  });

  it("accepts_a_technician_or_unassigned_dates_and_a_sort", () => {
    const technician = "11111111-2222-4333-8444-555555555555";
    expect(
      parseMaintenanceListParams({
        technician,
        from: "2026-10-05",
        to: "2026-10-01",
        sort: "priority",
      }),
    ).toMatchObject({
      technician,
      // A reversed range is swapped.
      from: "2026-10-01",
      to: "2026-10-05",
      sort: "priority",
    });
    expect(
      parseMaintenanceListParams({ technician: "unassigned" }).technician,
    ).toBe("unassigned");
  });

  it("builds_list_urls_without_empty_filters", () => {
    expect(
      maintenanceListQuery({ ...NONE, status: "OPEN", priority: "CRITICAL" }),
    ).toBe("?status=OPEN&priority=CRITICAL");
    expect(
      maintenanceListQuery({
        ...NONE,
        technician: "unassigned",
        from: "2026-10-01",
        sort: "oldest",
      }),
    ).toBe("?technician=unassigned&from=2026-10-01&sort=oldest");
    expect(maintenanceListQuery(NONE)).toBe("");
  });

  it("does_not_count_sorting_as_a_filter", () => {
    expect(hasMaintenanceFilters({ ...NONE, sort: "updated" })).toBe(false);
    expect(hasMaintenanceFilters({ ...NONE, to: "2026-10-01" })).toBe(true);
  });

  it("recognises_request_number_searches", () => {
    expect(isRequestNumberSearch("MR-2026-0017")).toBe(true);
    expect(isRequestNumberSearch("mr-2026")).toBe(true);
    expect(isRequestNumberSearch("projector")).toBe(false);
    expect(isRequestNumberSearch("AST-2026-00001")).toBe(false);
  });

  it("accepts_only_request_numbers_in_urls", () => {
    expect(requestNumberParam.safeParse("MR-2026-0017").success).toBe(true);
    expect(requestNumberParam.safeParse("MR-2026-17").success).toBe(false);
    expect(requestNumberParam.safeParse("../admin").success).toBe(false);
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
const insert = vi.fn();
const from = vi.fn(() => ({ insert }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));

const {
  addWorkNote,
  assignTechnician,
  cancelMaintenance,
  reportProblem,
  resolveMaintenance,
  startMaintenance,
} = await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const idle = { status: "idle" } as const;
const valid = { description: "No image on screen", priority: "HIGH" };

describe("reportProblem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "student-1", role: "STUDENT" });
    rpc.mockResolvedValue({ data: "MR-2026-0017", error: null });
  });

  it("reports_through_the_database_function_and_opens_the_request", async () => {
    await expect(
      reportProblem(
        ASSET,
        "AST-2026-00001",
        idle,
        form({ ...valid, reportedBy: "someone-else" }),
      ),
    ).rejects.toMatchObject({
      path: "/maintenance/MR-2026-0017?toast=problem-reported",
    });
    // No reporter is sent: the database uses the signed-in user.
    expect(rpc).toHaveBeenCalledWith("report_problem", {
      p_asset_id: ASSET,
      p_description: "No image on screen",
      p_priority: "HIGH",
    });
  });

  it("requires_a_signed_in_user", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      reportProblem(ASSET, "AST-2026-00001", idle, form(valid)),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns_field_errors_without_calling_the_database", async () => {
    const state = await reportProblem(
      ASSET,
      "AST-2026-00001",
      idle,
      form({ description: "", priority: "" }),
    );
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual([
      "description",
      "priority",
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["CA006", { message: expect.stringContaining("retired") }],
    ["P0002", { message: "This asset no longer exists." }],
    ["42501", { message: "Your account cannot report problems." }],
    ["23514", { fieldErrors: { description: ["Describe the problem."] } }],
    ["XX000", { message: "Unable to send the report. Please try again." }],
  ])("maps_database_error_%s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: "internal detail" },
    });
    const state = await reportProblem(
      ASSET,
      "AST-2026-00001",
      idle,
      form(valid),
    );
    expect(state).toMatchObject({ status: "error", ...expected });
    expect(JSON.stringify(state)).not.toContain("internal detail");
  });

  it("rejects_malformed_ids_without_calling_the_database", async () => {
    const state = await reportProblem(
      "nope",
      "AST-2026-00001",
      idle,
      form(valid),
    );
    expect(state.message).toBe("This asset no longer exists.");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("technician workflow schemas", () => {
  it("requires_a_technician_to_be_chosen", () => {
    expect(
      assignTechnicianSchema.safeParse({ technicianId: "" }).error?.issues[0]
        .message,
    ).toBe("Choose a technician.");
    expect(
      assignTechnicianSchema.safeParse({ technicianId: TECHNICIAN }).success,
    ).toBe(true);
  });

  it("accepts_work_note_types_but_not_workflow_steps", () => {
    expect(
      workNoteSchema.parse({ action: "REPAIR", notes: "  Lamp replaced  " }),
    ).toEqual({ action: "REPAIR", notes: "Lamp replaced" });
    for (const action of ["RESOLVED", "STARTED", "ASSIGNED", ""]) {
      expect(workNoteSchema.safeParse({ action, notes: "x" }).success).toBe(
        false,
      );
    }
  });

  it("requires_note_text_within_the_database_limit", () => {
    const blank = workNoteSchema.safeParse({ action: "NOTE", notes: "   " });
    expect(blank.error?.issues[0].message).toBe("Write what you found or did.");
    expect(
      workNoteSchema.safeParse({ action: "NOTE", notes: "x".repeat(2001) })
        .success,
    ).toBe(false);
  });
});

describe("assignTechnician", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("assigns_through_the_database_function", async () => {
    const state = await assignTechnician(
      REQUEST,
      "MR-2026-0017",
      idle,
      form({ technicianId: TECHNICIAN }),
    );
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(rpc).toHaveBeenCalledWith("assign_technician", {
      p_request_id: REQUEST,
      p_technician_id: TECHNICIAN,
    });
    expect(state).toMatchObject({ status: "success" });
  });

  it("asks_for_a_technician_without_calling_the_database", async () => {
    const state = await assignTechnician(
      REQUEST,
      "MR-2026-0017",
      idle,
      form({ technicianId: "" }),
    );
    expect(state.fieldErrors?.technicianId).toEqual(["Choose a technician."]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is_admin_only", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      assignTechnician(
        REQUEST,
        "MR-2026-0017",
        idle,
        form({ technicianId: TECHNICIAN }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["CA007", { message: expect.stringContaining("closed") }],
    [
      "CA008",
      {
        fieldErrors: {
          technicianId: [expect.stringContaining("no longer an active")],
        },
      },
    ],
    ["P0002", { message: "This maintenance request no longer exists." }],
    ["42501", { message: "Only admins can assign technicians." }],
    ["XX000", { message: expect.stringContaining("Unable to assign") }],
  ])("maps_database_error_%s", async (code, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: "internal detail" },
    });
    const state = await assignTechnician(
      REQUEST,
      "MR-2026-0017",
      idle,
      form({ technicianId: TECHNICIAN }),
    );
    expect(state).toMatchObject({ status: "error", ...expected });
    expect(JSON.stringify(state)).not.toContain("internal detail");
  });

  it("rejects_malformed_ids_without_calling_the_database", async () => {
    const state = await assignTechnician(
      REQUEST,
      "../MR-1",
      idle,
      form({ technicianId: TECHNICIAN }),
    );
    expect(state.message).toBe("This maintenance request no longer exists.");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("startMaintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "tech-1", role: "TECHNICIAN" });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("starts_through_the_database_function", async () => {
    const state = await startMaintenance(REQUEST, "MR-2026-0017");
    expect(rpc).toHaveBeenCalledWith("start_maintenance", {
      p_request_id: REQUEST,
    });
    expect(state.status).toBe("success");
  });

  it.each([
    ["CA007", expect.stringContaining("closed")],
    ["CA009", "Assign a technician before work can start."],
    ["42501", "Only the technician assigned to this request can start it."],
  ])("maps_database_error_%s", async (code, message) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "detail" } });
    const state = await startMaintenance(REQUEST, "MR-2026-0017");
    expect(state).toMatchObject({ status: "error", message });
  });
});

describe("addWorkNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "tech-1", role: "TECHNICIAN" });
    insert.mockResolvedValue({ error: null });
  });

  it("adds_the_note_without_an_author_field", async () => {
    const state = await addWorkNote(
      REQUEST,
      "MR-2026-0017",
      idle,
      form({ action: "DIAGNOSIS", notes: "HDMI board", performedBy: "x" }),
    );
    expect(from).toHaveBeenCalledWith("maintenance_history");
    // The database records the signed-in user as the author.
    expect(insert).toHaveBeenCalledWith({
      maintenance_request_id: REQUEST,
      action: "DIAGNOSIS",
      notes: "HDMI board",
    });
    expect(state.status).toBe("success");
  });

  it("validates_before_calling_the_database", async () => {
    const state = await addWorkNote(
      REQUEST,
      "MR-2026-0017",
      idle,
      form({ action: "RESOLVED", notes: "" }),
    );
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual([
      "action",
      "notes",
    ]);
    expect(state.values).toEqual({ action: "RESOLVED", notes: "" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("explains_when_notes_are_not_allowed", async () => {
    insert.mockResolvedValue({
      error: { code: "42501", message: "row-level security" },
    });
    const state = await addWorkNote(
      REQUEST,
      "MR-2026-0017",
      idle,
      form({ action: "NOTE", notes: "Checked" }),
    );
    expect(state.message).toContain("assigned technician");
    expect(state.values).toEqual({ action: "NOTE", notes: "Checked" });
  });
});

describe("resolution rules", () => {
  it("offers_final_states_only_for_assets_that_can_change", () => {
    expect(resolutionAssetStates("IN_MAINTENANCE", false)).toEqual([
      "AVAILABLE",
      "DAMAGED",
    ]);
    expect(resolutionAssetStates("AVAILABLE", true)).toEqual([
      "AVAILABLE",
      "DAMAGED",
      "RETIRED",
    ]);
    for (const status of ["ASSIGNED", "LOST", "RETIRED"] as const) {
      expect(resolutionAssetStates(status, true)).toBeNull();
    }
  });

  it("explains_the_outcome", () => {
    expect(resolvedMessage("IN_MAINTENANCE")).toContain(
      "another serious problem is still open",
    );
    expect(resolvedMessage(undefined)).toBe("Request resolved.");
    expect(unchangedAssetExplanation("ASSIGNED")).toContain("stays with them");
  });
});

describe("resolution schemas", () => {
  it("requires_notes_and_treats_an_empty_state_as_unchanged", () => {
    expect(
      resolveSchema.parse({ resolutionNotes: " Fixed ", assetStatus: "" }),
    ).toEqual({ resolutionNotes: "Fixed", assetStatus: null });
    const result = resolveSchema.safeParse({
      resolutionNotes: "  ",
      assetStatus: "LOST",
    });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "resolutionNotes",
      "assetStatus",
    ]);
  });

  it("requires_a_short_cancellation_reason", () => {
    expect(cancelSchema.safeParse({ reason: " " }).success).toBe(false);
    expect(cancelSchema.safeParse({ reason: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(cancelSchema.parse({ reason: " Duplicate " })).toEqual({
      reason: "Duplicate",
    });
  });
});

describe("resolveMaintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "tech-1", role: "TECHNICIAN" });
    rpc.mockResolvedValue({ data: "AVAILABLE", error: null });
  });

  const resolveForm = (fields: Record<string, string>) =>
    resolveMaintenance(
      REQUEST,
      "MR-2026-0017",
      "AST-2026-00001",
      idle,
      form(fields),
    );

  it("resolves_through_the_database_function_and_reports_the_asset_status", async () => {
    const state = await resolveForm({
      resolutionNotes: "Replaced the lamp",
      assetStatus: "AVAILABLE",
    });
    expect(rpc).toHaveBeenCalledWith("resolve_maintenance", {
      p_request_id: REQUEST,
      p_resolution_notes: "Replaced the lamp",
      p_asset_status: "AVAILABLE",
    });
    expect(state).toMatchObject({
      status: "success",
      values: { assetStatus: "AVAILABLE" },
    });
  });

  it("sends_no_state_when_the_asset_is_left_as_it_is", async () => {
    await resolveForm({ resolutionNotes: "Fixed in place" });
    expect(rpc).toHaveBeenCalledWith(
      "resolve_maintenance",
      expect.objectContaining({ p_asset_status: null }),
    );
  });

  it.each([
    ["CA009", { message: "Start work before resolving the request." }],
    ["CA010", { fieldErrors: { assetStatus: [expect.any(String)] } }],
    ["CA007", { message: expect.stringContaining("closed") }],
    [
      "23514",
      { fieldErrors: { resolutionNotes: ["Describe what was done."] } },
    ],
    ["42501", { message: expect.stringContaining("assigned technician") }],
  ])("maps_database_error_%s", async (code, expected) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "detail" } });
    const state = await resolveForm({
      resolutionNotes: "Fixed",
      assetStatus: "AVAILABLE",
    });
    expect(state).toMatchObject({ status: "error", ...expected });
  });

  it("validates_before_calling_the_database", async () => {
    const state = await resolveForm({ resolutionNotes: "", assetStatus: "" });
    expect(state.fieldErrors?.resolutionNotes).toEqual([
      "Describe what was done.",
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("cancelMaintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    rpc.mockResolvedValue({ data: "AVAILABLE", error: null });
  });

  const cancelForm = (reason: string) =>
    cancelMaintenance(
      REQUEST,
      "MR-2026-0017",
      "AST-2026-00001",
      idle,
      form({ reason }),
    );

  it("is_admin_only_and_cancels_through_the_database_function", async () => {
    const state = await cancelForm("Duplicate");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(rpc).toHaveBeenCalledWith("cancel_maintenance", {
      p_request_id: REQUEST,
      p_reason: "Duplicate",
    });
    expect(state).toMatchObject({
      status: "success",
      values: { assetStatus: "AVAILABLE" },
    });
  });

  it("asks_for_a_reason", async () => {
    const state = await cancelForm("  ");
    expect(state.fieldErrors?.reason).toEqual([
      "Say why the request is being cancelled.",
    ]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains_that_started_work_cannot_be_cancelled", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "CA009", message: "detail" },
    });
    const state = await cancelForm("Duplicate");
    expect(state.message).toContain("Work has already started");
  });
});
