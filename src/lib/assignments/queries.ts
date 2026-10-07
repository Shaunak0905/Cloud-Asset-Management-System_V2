import "server-only";

import { PGRST_RANGE_NOT_SATISFIABLE } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

// Reads run as the signed-in user: RLS returns a user's own assignments, and
// every assignment to admins.

export const ASSIGNMENTS_PAGE_SIZE = 20;

function loadError(what: string, error: { code?: string; message: string }) {
  console.error(
    `[assignments] failed to load ${what}:`,
    error.code,
    error.message,
  );
  return new Error(`Unable to load ${what}.`);
}

/**
 * The asset's ACTIVE assignment if the caller may see it (their own, or any
 * for admins). Null otherwise — including when someone else has the asset.
 */
export async function getVisibleActiveAssignment(assetUuid: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_assignments")
    .select(
      "id, user_id, assigned_at, expected_return_at, notes, buildings(name, code), rooms!asset_assignments_usage_room_fkey(room_number, display_name), profiles!asset_assignments_user_id_fkey(full_name, email)",
    )
    .eq("asset_id", assetUuid)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error) throw loadError("assignment", error);
  return data;
}

/** The user's assignments: active first, then newest. */
export async function listMyAssignments(userId: string, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * ASSIGNMENTS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("asset_assignments")
    .select(
      "id, status, assigned_at, expected_return_at, returned_at, notes, assets(asset_id, name, category), buildings(name, code), rooms!asset_assignments_usage_room_fkey(room_number, display_name)",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("status") // enum declaration order: ACTIVE comes first
    .order("assigned_at", { ascending: false })
    .range(from, from + ASSIGNMENTS_PAGE_SIZE - 1);

  if (error?.code === PGRST_RANGE_NOT_SATISFIABLE)
    return { rows: [], total: null };
  if (error) throw loadError("assignments", error);
  return { rows: data, total: count ?? 0 };
}

/**
 * ACTIVE assignments, soonest expected return first (no return time last),
 * for dashboards. With `userId`, only that user's; RLS shows non-admins
 * only their own anyway. With `overdueOnly`, only those past their expected
 * return (docs/12 §40).
 */
export async function listActiveAssignments({
  userId,
  overdueOnly = false,
  limit,
}: {
  userId?: string;
  overdueOnly?: boolean;
  limit: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("asset_assignments")
    .select(
      "id, user_id, assigned_at, expected_return_at, assets(asset_id, name), buildings(name, code), rooms!asset_assignments_usage_room_fkey(room_number, display_name), profiles!asset_assignments_user_id_fkey(full_name, email)",
    )
    .eq("status", "ACTIVE");
  if (userId) query = query.eq("user_id", userId);
  if (overdueOnly)
    query = query.lt("expected_return_at", new Date().toISOString());
  const { data, error } = await query
    .order("expected_return_at", { ascending: true, nullsFirst: false })
    .order("assigned_at", { ascending: true })
    .limit(limit);
  if (error) throw loadError("assignments", error);
  return data;
}

export type ActiveAssignment = Awaited<
  ReturnType<typeof listActiveAssignments>
>[number];

export type MyAssignment = NonNullable<
  Awaited<ReturnType<typeof listMyAssignments>>["rows"]
>[number];

export const ASSET_HISTORY_LIMIT = 10;

/** An asset's assignments, newest first (admins see all of them). */
export async function listAssetAssignments(assetUuid: string) {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("asset_assignments")
    .select(
      "id, status, assigned_at, returned_at, expected_return_at, buildings(name, code), rooms!asset_assignments_usage_room_fkey(room_number, display_name), profiles!asset_assignments_user_id_fkey(full_name, email)",
      { count: "exact" },
    )
    .eq("asset_id", assetUuid)
    .order("assigned_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(ASSET_HISTORY_LIMIT);
  if (error) throw loadError("assignment history", error);
  return { rows: data, total: count ?? data.length };
}

/**
 * The user with this sign-in email, for admins choosing who receives an
 * asset. RLS lets only admins read other people's profiles.
 */
export async function findUserByEmail(email: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .eq("email", email)
    .maybeSingle();
  if (error) throw loadError("user", error);
  return data;
}
