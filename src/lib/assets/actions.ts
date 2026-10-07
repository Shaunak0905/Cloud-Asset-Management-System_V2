"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth/current-user";
import {
  type DbError,
  isPermissionError,
  isUniqueViolation,
  PG_CHECK_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PGRST_NO_ROWS,
  violatedConstraint,
} from "@/lib/db-errors";
import { withFlash } from "@/lib/flash";
import { type FormState, invalidForm, readFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { Constants } from "@/types/database";

import { ASSET_FORM_FIELDS, assetFormSchema, toAssetColumns } from "./schema";

// Admin-only asset management. Every action re-checks the role (Server
// Actions are public endpoints); RLS, grants and triggers enforce the same
// rules in the database, and the database writes the audit trail.

function revalidateAssetPages(assetId?: string) {
  revalidatePath("/assets");
  revalidatePath("/admin/assets");
  if (assetId) revalidatePath(`/assets/${assetId}`);
}

function failure(error: DbError, values?: Record<string, string>): FormState {
  const field = (name: string, message: string): FormState => ({
    status: "error",
    fieldErrors: { [name]: [message] },
    values,
  });

  if (isUniqueViolation(error, "assets_serial_number_key")) {
    return field(
      "serialNumber",
      "Another asset already has this serial number.",
    );
  }
  if (error.code === PG_FOREIGN_KEY_VIOLATION) {
    return violatedConstraint(error) === "assets_registered_room_fkey"
      ? field(
          "roomId",
          "The selected room does not belong to the selected building.",
        )
      : field("buildingId", "Select a valid building.");
  }
  if (
    error.code === PG_CHECK_VIOLATION &&
    violatedConstraint(error) === "assets_category_valid"
  ) {
    return field("category", "Choose a category.");
  }

  let message: string;
  if (isPermissionError(error)) {
    message = "You do not have permission to change assets.";
  } else if (error.code === PGRST_NO_ROWS) {
    message = "This asset no longer exists.";
  } else if (error.code === PG_CHECK_VIOLATION) {
    message = "This change is not allowed for the asset in its current state.";
  } else {
    console.error("[assets] write failed:", error.code, error.message);
    message = "Unable to save the asset. Please try again.";
  }
  return { status: "error", message, values };
}

export async function createAsset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  const values = readFields(formData, ASSET_FORM_FIELDS);

  const parsed = assetFormSchema().safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .insert(toAssetColumns(parsed.data))
    .select("asset_id")
    .single();
  if (error) return failure(error, values);

  revalidateAssetPages();
  redirect(withFlash(`/assets/${data.asset_id}`, "asset-created"));
}

export async function updateAsset(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  if (!z.uuid().safeParse(id).success) {
    return { status: "error", message: "This asset no longer exists." };
  }
  const values = readFields(formData, ASSET_FORM_FIELDS);

  const parsed = assetFormSchema().safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .update(toAssetColumns(parsed.data))
    .eq("id", id)
    .select("asset_id")
    .single();
  if (error) return failure(error, values);

  revalidateAssetPages(data.asset_id);
  redirect(withFlash(`/assets/${data.asset_id}`, "asset-updated"));
}

const manualStatus = z.enum(
  Constants.public.Enums.asset_status.filter((status) => status !== "ASSIGNED"),
  "Choose a status.",
);

/**
 * Changes an asset's status by hand. The database only accepts documented
 * transitions, and ASSIGNED is reserved for the assignment workflow.
 */
export async function changeAssetStatus(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  if (!z.uuid().safeParse(id).success) {
    return { status: "error", message: "This asset no longer exists." };
  }

  const parsed = manualStatus.safeParse(formData.get("status"));
  if (!parsed.success) {
    return { status: "error", fieldErrors: { status: ["Choose a status."] } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .update({ status: parsed.data })
    .eq("id", id)
    .select("asset_id, status")
    .single();
  if (error) return failure(error);

  revalidateAssetPages(data.asset_id);
  return {
    status: "success",
    savedAt: Date.now(),
    values: { status: data.status },
  };
}
