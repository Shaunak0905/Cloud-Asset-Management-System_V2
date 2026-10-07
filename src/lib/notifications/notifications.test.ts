import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  }),
}));

const requireUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: () => requireUser(),
}));

const result = { data: null as unknown, error: null as unknown };
const update = vi.fn();
const eq = vi.fn();
const builder = {
  update: (...args: unknown[]) => {
    update(...args);
    return builder;
  },
  eq: (...args: unknown[]) => {
    eq(...args);
    return builder;
  },
  select: () => builder,
  maybeSingle: async () => result,
  then: (resolve: (value: unknown) => unknown) => resolve(result),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => builder }),
}));

const { markAllNotificationsRead, openNotification } =
  await import("./actions");

const ID = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "user-1", role: "STUDENT" });
  result.data = null;
  result.error = null;
});

describe("openNotification", () => {
  it("marks_it_read_and_goes_where_it_points", async () => {
    result.data = { link: "/assets/AST-2026-00001" };
    await expect(openNotification(ID)).rejects.toMatchObject({
      path: "/assets/AST-2026-00001",
    });
    expect(update).toHaveBeenCalledWith({ is_read: true });
    expect(eq).toHaveBeenCalledWith("id", ID);
    // The unread badge in the layout is refreshed.
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("never_follows_a_link_off_the_site", async () => {
    result.data = { link: "//evil.example/phish" };
    await expect(openNotification(ID)).rejects.toMatchObject({
      path: "/notifications",
    });
  });

  it("goes_back_to_the_list_for_an_unknown_or_malformed_id", async () => {
    await expect(openNotification(ID)).rejects.toMatchObject({
      path: "/notifications",
    });
    await expect(openNotification("../admin")).rejects.toMatchObject({
      path: "/notifications",
    });
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe("markAllNotificationsRead", () => {
  it("marks_only_the_signed_in_users_unread_notifications", async () => {
    const state = await markAllNotificationsRead();
    expect(state.status).toBe("success");
    expect(update).toHaveBeenCalledWith({ is_read: true });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(eq).toHaveBeenCalledWith("is_read", false);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("reports_a_failure_without_details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    result.error = { code: "42501", message: "permission denied" };
    const state = await markAllNotificationsRead();
    expect(state).toEqual({
      status: "error",
      message: "Unable to mark notifications as read. Please try again.",
    });
  });
});
