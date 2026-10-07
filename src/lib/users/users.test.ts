import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasUserFilters, parseUserListParams, userListQuery } from "./schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireRole = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  requireRole: (roles: string[]) => requireRole(roles),
}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

const { changeUserRole, setUserActive } = await import("./actions");

const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const USER = "11111111-2222-4333-8444-555555555555";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("user list params", () => {
  it("keeps_valid_filters_and_drops_the_rest", () => {
    expect(
      parseUserListParams({
        search: " priya@campus.edu ",
        role: "TECHNICIAN",
        status: "inactive",
        page: "2",
      }),
    ).toEqual({
      search: "priya@campus.edu",
      role: "TECHNICIAN",
      status: "inactive",
      page: 2,
    });
    expect(
      parseUserListParams({ role: "ROOT", status: "banned", search: '",' }),
    ).toEqual({ search: null, role: null, status: null, page: 1 });
  });

  it("round_trip_through_the_url", () => {
    const params = parseUserListParams({ role: "ADMIN", page: "3" });
    expect(userListQuery(params)).toBe("?role=ADMIN&page=3");
    expect(hasUserFilters(params)).toBe(true);
    expect(hasUserFilters(parseUserListParams({}))).toBe(false);
  });
});

describe("changeUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: ADMIN, role: "ADMIN" });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("changes_the_role_through_the_audited_database_function", async () => {
    const state = await changeUserRole(
      USER,
      { status: "idle" },
      form({ role: "TECHNICIAN" }),
    );
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(rpc).toHaveBeenCalledWith("change_user_role", {
      target_user_id: USER,
      new_role: "TECHNICIAN",
    });
    expect(state.status).toBe("success");
  });

  it("refuses_the_admins_own_account_without_calling_the_database", async () => {
    const state = await changeUserRole(
      ADMIN,
      { status: "idle" },
      form({ role: "STUDENT" }),
    );
    expect(state.message).toBe("You cannot change your own role.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects_unknown_roles", async () => {
    const state = await changeUserRole(
      USER,
      { status: "idle" },
      form({ role: "ROOT" }),
    );
    expect(state.fieldErrors?.role).toEqual(["Choose a role."]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains_that_a_technician_with_open_work_must_hand_it_over_first", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23514",
        message: "Reassign this technician's open maintenance requests first",
      },
    });
    const state = await changeUserRole(
      USER,
      { status: "idle" },
      form({ role: "STUDENT" }),
    );
    expect(state.message).toContain("Reassign them first");
  });
});

describe("setUserActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: ADMIN, role: "ADMIN" });
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it("deactivates_and_reactivates_through_the_database_function", async () => {
    await setUserActive(USER, false);
    expect(rpc).toHaveBeenCalledWith("set_user_active", {
      target_user_id: USER,
      active: false,
    });
  });

  it("rejects_a_tampered_status_argument", async () => {
    const state = await setUserActive(USER, "yes" as unknown as boolean);
    expect(state.status).toBe("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses_to_deactivate_the_admins_own_account", async () => {
    const state = await setUserActive(ADMIN, false);
    expect(state.message).toBe("You cannot deactivate your own account.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hides_unexpected_database_errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "internal" },
    });
    const state = await setUserActive(USER, true);
    expect(state.message).toBe(
      "Unable to change the account status. Please try again.",
    );
  });
});
