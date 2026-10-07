import "server-only";

import { PGRST_RANGE_NOT_SATISFIABLE } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

// Notifications are written by the nightly reminders job; RLS shows each
// signed-in user only their own.

export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * Unread notifications for the badge in the navigation. Shown on every page,
 * so a failure is logged and treated as "none" rather than breaking the page.
 */
export async function countUnreadNotifications(
  userId: string,
): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) {
      console.error("[notifications] count failed:", error.code, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (error) {
    console.error("[notifications] count failed:", error);
    return 0;
  }
}

/** The user's notifications, newest first. */
export async function listNotifications(userId: string, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * NOTIFICATIONS_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, link, is_read, created_at", {
      count: "exact",
    })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + NOTIFICATIONS_PAGE_SIZE - 1);

  if (error?.code === PGRST_RANGE_NOT_SATISFIABLE) {
    return { rows: [], total: null };
  }
  if (error) {
    console.error("[notifications] list failed:", error.code, error.message);
    throw new Error("Unable to load notifications.");
  }
  return { rows: data, total: count ?? 0 };
}

export type NotificationItem = Awaited<
  ReturnType<typeof listNotifications>
>["rows"][number];
