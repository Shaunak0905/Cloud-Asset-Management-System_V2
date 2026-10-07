"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { safeRedirectPath } from "@/lib/auth/routes";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const LIST = "/notifications";

/**
 * Marks a notification read and goes where it points. RLS lets users change
 * only their own notifications, and only the read flag. The link is a
 * same-site path (enforced by the database) and is checked again here.
 */
export async function openNotification(id: string): Promise<void> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) redirect(LIST);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .select("link")
    .maybeSingle();
  if (error) {
    console.error("[notifications] open failed:", error.code, error.message);
  }

  // The unread badge lives in the shared layout.
  revalidatePath("/", "layout");
  redirect(safeRedirectPath(data?.link) ?? LIST);
}

/** Marks all of the signed-in user's notifications read. */
export async function markAllNotificationsRead(): Promise<FormState> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) {
    console.error(
      "[notifications] mark all failed:",
      error.code,
      error.message,
    );
    return {
      status: "error",
      message: "Unable to mark notifications as read. Please try again.",
    };
  }
  revalidatePath("/", "layout");
  return { status: "success", savedAt: Date.now() };
}
