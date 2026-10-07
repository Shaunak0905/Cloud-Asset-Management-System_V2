import "server-only";

import { PGRST_RANGE_NOT_SATISFIABLE } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

import { USERS_PAGE_SIZE, type UserListParams } from "./schema";

// RLS lets admins read every profile; anyone else would see only their own.

/** Users for the admin list, by name, with search and filters. */
export async function listUsers(params: UserListParams) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, department, is_active, created_at", {
      count: "exact",
    });

  // The search text is sanitised by normalizeActorSearch() and quoted.
  if (params.search) {
    const value = `"%${params.search}%"`;
    query = query.or(`full_name.ilike.${value},email.ilike.${value}`);
  }
  if (params.role) query = query.eq("role", params.role);
  if (params.status) query = query.eq("is_active", params.status === "active");

  const from = (params.page - 1) * USERS_PAGE_SIZE;
  const { data, count, error } = await query
    .order("full_name")
    .order("email")
    .range(from, from + USERS_PAGE_SIZE - 1);

  if (error?.code === PGRST_RANGE_NOT_SATISFIABLE) {
    return { rows: [], total: null };
  }
  if (error) {
    console.error("[users] failed to load users:", error.code, error.message);
    throw new Error("Unable to load users.");
  }
  return { rows: data, total: count ?? 0 };
}

export type UserRow = Awaited<ReturnType<typeof listUsers>>["rows"][number];
