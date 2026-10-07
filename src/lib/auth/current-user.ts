import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { ACCOUNT_INACTIVE_PATH, FORBIDDEN_PATH, LOGIN_PATH } from "./routes";
import type { CurrentUser, UserRole } from "./types";

export type AuthState =
  | { status: "anonymous" }
  | { status: "missing_profile"; userId: string }
  | { status: "inactive"; user: CurrentUser }
  | { status: "active"; user: CurrentUser };

/**
 * Resolves the session and profile for the current request (memoized per
 * request). The role always comes from the database, never from the client.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();

  // getClaims() verifies the JWT; an invalid or expired session is anonymous.
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return { status: "anonymous" };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, department, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[auth] failed to load profile:", error.code, error.message);
    throw new Error("Unable to load your account. Please try again.");
  }
  if (!profile) {
    return { status: "missing_profile", userId };
  }

  const user: CurrentUser = {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    department: profile.department,
  };
  return profile.is_active
    ? { status: "active", user }
    : { status: "inactive", user };
});

/** The active signed-in user, or null (anonymous, inactive or no profile). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await getAuthState();
  return state.status === "active" ? state.user : null;
}

/**
 * Page guard: returns the active user, or redirects to /login (no session) or
 * the inactive-account page. Call it in every protected page — layouts do not
 * re-run on client-side navigation.
 */
export async function requireUser(): Promise<CurrentUser> {
  const state = await getAuthState();
  switch (state.status) {
    case "anonymous":
      return redirect(LOGIN_PATH);
    case "missing_profile":
    case "inactive":
      return redirect(ACCOUNT_INACTIVE_PATH);
    case "active":
      return state.user;
  }
}

/** Page guard for role-restricted pages: wrong role -> access denied page. */
export async function requireRole(
  roles: readonly UserRole[],
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    redirect(FORBIDDEN_PATH);
  }
  return user;
}
