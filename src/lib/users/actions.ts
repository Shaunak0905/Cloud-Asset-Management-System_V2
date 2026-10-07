"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/current-user";
import {
  type DbError,
  isPermissionError,
  PG_CHECK_VIOLATION,
} from "@/lib/db-errors";
import { type FormState, readFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { roleChangeSchema } from "./schema";

const USER_GONE = "This user no longer exists.";

/**
 * Maps the account functions' errors. Both refuse an admin changing their
 * own account (checked before calling) and a technician who still has open
 * maintenance; database messages are never shown.
 */
function accountError(error: DbError, fallback: string): FormState {
  if (error.code === "P0002") return { status: "error", message: USER_GONE };
  if (error.code === PG_CHECK_VIOLATION) {
    return {
      status: "error",
      message:
        "This technician still has open maintenance requests. Reassign them first.",
    };
  }
  if (isPermissionError(error)) {
    return { status: "error", message: "Only admins can manage accounts." };
  }
  console.error("[users] account change failed:", error.code, error.message);
  return { status: "error", message: fallback };
}

/**
 * Admin: changes a user's role through change_user_role, which checks the
 * caller is an admin, refuses self-changes and technicians with open work,
 * and records ROLE_CHANGED in the audit log (docs/05 §24).
 */
export async function changeUserRole(
  userId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);
  if (!z.uuid().safeParse(userId).success) {
    return { status: "error", message: USER_GONE };
  }
  if (userId === admin.id) {
    return { status: "error", message: "You cannot change your own role." };
  }

  const values = readFields(formData, ["role"]);
  const parsed = roleChangeSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", fieldErrors: { role: ["Choose a role."] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_user_role", {
    target_user_id: userId,
    new_role: parsed.data.role,
  });
  if (error) {
    return accountError(error, "Unable to change the role. Please try again.");
  }

  revalidatePath("/admin/users");
  return { status: "success", savedAt: Date.now(), values };
}

/**
 * Admin: activates or deactivates an account through set_user_active
 * (audited as ACCOUNT_ACTIVATED / ACCOUNT_DEACTIVATED). A deactivated user
 * keeps their history but can no longer use the app (docs/05 §8).
 */
export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<FormState> {
  const admin = await requireRole(["ADMIN"]);
  // Both arguments are bound in the page but arrive from the browser.
  if (!z.uuid().safeParse(userId).success || typeof active !== "boolean") {
    return { status: "error", message: USER_GONE };
  }
  if (userId === admin.id) {
    return {
      status: "error",
      message: "You cannot deactivate your own account.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_active", {
    target_user_id: userId,
    active,
  });
  if (error) {
    return accountError(
      error,
      "Unable to change the account status. Please try again.",
    );
  }

  revalidatePath("/admin/users");
  return { status: "success", savedAt: Date.now() };
}
