import { AuthApiError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SIGN_IN_MESSAGES } from "./sign-in";

// --- Mocks -------------------------------------------------------------------

const redirectError = (path: string) =>
  Object.assign(new Error("NEXT_REDIRECT"), { path });

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw redirectError(path);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const auth = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
};
let profileResult: { data: unknown; error: unknown };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => profileResult }),
      }),
    }),
  }),
}));

const { signIn, signOut } = await import("./actions");

// --- Helpers -----------------------------------------------------------------

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function expectRedirect(promise: Promise<unknown>, path: string) {
  await expect(promise).rejects.toMatchObject({
    message: "NEXT_REDIRECT",
    path,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  auth.signOut.mockResolvedValue({ error: null });
  profileResult = { data: { role: "STUDENT", is_active: true }, error: null };
});

// --- Tests -------------------------------------------------------------------

describe("signIn", () => {
  it("returns_field_errors_without_contacting_supabase", async () => {
    const state = await signIn({}, form({ email: "nope", password: "" }));
    expect(state.fieldErrors?.email).toEqual(["Enter a valid email address."]);
    expect(state.fieldErrors?.password).toEqual(["Enter your password."]);
    expect(state.email).toBe("nope");
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns_a_safe_message_for_wrong_credentials_and_keeps_only_the_email", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError(
        "Invalid login credentials",
        400,
        "invalid_credentials",
      ),
    });
    const state = await signIn(
      {},
      form({ email: "a@campus.edu", password: "wrong" }),
    );
    expect(state).toEqual({
      email: "a@campus.edu",
      message: SIGN_IN_MESSAGES.invalidCredentials,
    });
    expect(JSON.stringify(state)).not.toContain("wrong");
  });

  it("redirects_to_the_role_home_on_success", async () => {
    profileResult = {
      data: { role: "TECHNICIAN", is_active: true },
      error: null,
    };
    await expectRedirect(
      signIn({}, form({ email: "t@campus.edu", password: "pw" })),
      "/technician",
    );
  });

  it("redirects_to_a_safe_next_path", async () => {
    await expectRedirect(
      signIn(
        {},
        form({
          email: "s@campus.edu",
          password: "pw",
          next: "/asset/AST-2026-00001",
        }),
      ),
      "/asset/AST-2026-00001",
    );
  });

  it("ignores_an_unsafe_next_path", async () => {
    await expectRedirect(
      signIn(
        {},
        form({
          email: "s@campus.edu",
          password: "pw",
          next: "https://evil.example",
        }),
      ),
      "/dashboard",
    );
  });

  it("signs_out_and_explains_when_the_account_is_inactive", async () => {
    profileResult = {
      data: { role: "STUDENT", is_active: false },
      error: null,
    };
    const state = await signIn(
      {},
      form({ email: "s@campus.edu", password: "pw" }),
    );
    expect(state.message).toBe(SIGN_IN_MESSAGES.inactive);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("signs_out_when_the_profile_is_missing", async () => {
    profileResult = { data: null, error: null };
    const state = await signIn(
      {},
      form({ email: "s@campus.edu", password: "pw" }),
    );
    expect(state.message).toBe(SIGN_IN_MESSAGES.noProfile);
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("signs_out_when_the_profile_cannot_be_loaded", async () => {
    profileResult = {
      data: null,
      error: { code: "PGRST000", message: "db down" },
    };
    const state = await signIn(
      {},
      form({ email: "s@campus.edu", password: "pw" }),
    );
    expect(state.message).toBe(SIGN_IN_MESSAGES.unavailable);
    expect(auth.signOut).toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("ends_the_local_session_and_redirects_to_login", async () => {
    await expectRedirect(signOut(), "/login");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("still_redirects_to_login_if_the_auth_api_fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    auth.signOut.mockResolvedValue({
      error: new AuthApiError("down", 500, "unexpected_failure"),
    });
    await expectRedirect(signOut(), "/login");
  });
});
