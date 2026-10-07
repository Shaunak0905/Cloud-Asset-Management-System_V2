"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assetIdParam } from "@/lib/assets/schema";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import { type DbError, isPermissionError } from "@/lib/db-errors";
import { withFlash } from "@/lib/flash";
import { type FormState, invalidForm, readFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { findUserByEmail } from "./queries";
import {
  ASSIGN_FORM_FIELDS,
  ASSIGNMENT_ERRORS,
  assignAssetSchema,
  REQUEST_FORM_FIELDS,
  requestAssetSchema,
} from "./schema";

const UNAVAILABLE = "This asset is no longer available.";
const ASSET_GONE = "This asset no longer exists.";
const CHANGED =
  "This asset's assignment has changed since you opened the page (it was returned or transferred). Go back to the asset to see who has it now.";

function revalidateAssignmentPages(assetId: string) {
  revalidatePath("/assets");
  revalidatePath("/admin/assets");
  revalidatePath("/assignments");
  revalidatePath(`/assets/${assetId}`);
}

function fieldError(
  name: string,
  message: string,
  values?: Record<string, string>,
): FormState {
  return { status: "error", fieldErrors: { [name]: [message] }, values };
}

/**
 * Maps the assignment workflow functions' errors to form messages. Database
 * messages are never shown; unexpected errors are logged.
 */
function workflowErrorState(
  error: DbError,
  values: Record<string, string> | undefined,
  messages: {
    permission: string;
    notFound: string;
    fallback: string;
    closed?: string;
  },
): FormState {
  switch (error.code) {
    case ASSIGNMENT_ERRORS.unavailable:
      return { status: "error", message: UNAVAILABLE, values };
    case ASSIGNMENT_ERRORS.invalidLocation:
      return fieldError(
        "roomId",
        "The selected room does not belong to the selected building, or is not in use.",
        values,
      );
    case ASSIGNMENT_ERRORS.invalidReturn:
      return fieldError(
        "expectedReturn",
        "Expected return must be in the future and within a year.",
        values,
      );
    case ASSIGNMENT_ERRORS.closed:
      return { status: "error", message: messages.closed ?? CHANGED, values };
    case ASSIGNMENT_ERRORS.inactiveUser:
      return fieldError(
        "userEmail",
        "This person's account is not active.",
        values,
      );
    case "P0002":
      return { status: "error", message: messages.notFound };
  }
  if (isPermissionError(error)) {
    return { status: "error", message: messages.permission, values };
  }
  console.error("[assignments] workflow failed:", error.code, error.message);
  return { status: "error", message: messages.fallback, values };
}

/**
 * Requests an asset for the signed-in user at a chosen building/room. All
 * checks and changes happen in the request_asset database function, in one
 * transaction; the user is always the caller, never a form value.
 */
export async function requestAsset(
  id: string,
  assetId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  if (
    !z.uuid().safeParse(id).success ||
    !assetIdParam.safeParse(assetId).success
  ) {
    return { status: "error", message: ASSET_GONE };
  }

  const values = readFields(formData, REQUEST_FORM_FIELDS);
  const parsed = requestAssetSchema().safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_asset", {
    p_asset_id: id,
    p_usage_building_id: parsed.data.buildingId,
    p_usage_room_id: parsed.data.roomId,
    p_expected_return_at: parsed.data.expectedReturn,
    p_notes: parsed.data.notes,
  });

  if (error) {
    return workflowErrorState(error, values, {
      permission: "Your account cannot request assets.",
      notFound: ASSET_GONE,
      fallback: "Unable to request the asset. Please try again.",
    });
  }

  revalidateAssignmentPages(assetId);
  redirect(withFlash(`/assets/${assetId}`, "asset-requested"));
}

/**
 * Returns an asset. The return_asset database function allows only the
 * person using it, or an admin, and makes the asset available again.
 * Returns a result (not a redirect) so it works from any page.
 */
export async function returnAsset(
  assignmentId: string,
  assetId: string,
): Promise<FormState> {
  await requireUser();
  if (
    !z.uuid().safeParse(assignmentId).success ||
    !assetIdParam.safeParse(assetId).success
  ) {
    return { status: "error", message: "This assignment no longer exists." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("return_asset", {
    p_assignment_id: assignmentId,
  });

  if (error) {
    return workflowErrorState(error, undefined, {
      permission: "You can only return assets assigned to you.",
      notFound: "This assignment no longer exists.",
      closed: "This asset has already been returned.",
      fallback: "Unable to return the asset. Please try again.",
    });
  }

  revalidateAssignmentPages(assetId);
  return { status: "success", savedAt: Date.now() };
}

/**
 * Admin: gives an asset to a user. With `currentAssignmentId` this is a
 * transfer of that assignment (the old one is kept as history); without it
 * the asset must be available. If the asset changed in the meantime the
 * database refuses rather than overriding someone else's assignment.
 */
export async function assignAsset(
  id: string,
  assetId: string,
  currentAssignmentId: string | null,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  if (
    !z.uuid().safeParse(id).success ||
    !assetIdParam.safeParse(assetId).success ||
    (currentAssignmentId !== null &&
      !z.uuid().safeParse(currentAssignmentId).success)
  ) {
    return { status: "error", message: ASSET_GONE };
  }

  const values = readFields(formData, ASSIGN_FORM_FIELDS);
  const parsed = assignAssetSchema().safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const recipient = await findUserByEmail(parsed.data.userEmail);
  if (!recipient) {
    return fieldError("userEmail", "No user has this email address.", values);
  }
  if (!recipient.is_active) {
    return fieldError(
      "userEmail",
      "This person's account is not active.",
      values,
    );
  }

  const location = {
    p_usage_building_id: parsed.data.buildingId,
    p_usage_room_id: parsed.data.roomId,
    p_expected_return_at: parsed.data.expectedReturn,
    p_notes: parsed.data.notes,
  };
  const supabase = await createClient();
  const { error } = currentAssignmentId
    ? await supabase.rpc("transfer_asset", {
        p_assignment_id: currentAssignmentId,
        p_to_user_id: recipient.id,
        ...location,
      })
    : await supabase.rpc("assign_asset", {
        p_asset_id: id,
        p_user_id: recipient.id,
        ...location,
      });

  if (error) {
    return workflowErrorState(error, values, {
      permission: "Only admins can assign assets to other people.",
      notFound: currentAssignmentId ? CHANGED : ASSET_GONE,
      fallback: "Unable to assign the asset. Please try again.",
    });
  }

  revalidateAssignmentPages(assetId);
  redirect(
    withFlash(
      `/assets/${assetId}`,
      currentAssignmentId ? "asset-transferred" : "asset-assigned",
    ),
  );
}
