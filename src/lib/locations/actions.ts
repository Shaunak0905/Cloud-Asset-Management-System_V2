"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/current-user";
import {
  type DbError,
  isPermissionError,
  isUniqueViolation,
  PG_FOREIGN_KEY_VIOLATION,
  PGRST_NO_ROWS,
} from "@/lib/db-errors";
import { withFlash } from "@/lib/flash";
import { invalidForm as invalid, readFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import {
  buildingSchema,
  buildingUpdateSchema,
  idSchema,
  type LocationFormState,
  roomSchema,
  roomUpdateSchema,
} from "./schema";

// Admin-only location management. Every action re-checks the role: Server
// Actions are public endpoints. RLS enforces the same rule in the database.

const ADMIN_PATH = "/admin/buildings";

function failure(
  error: DbError,
  values: Record<string, string>,
  subject: "building" | "room",
): LocationFormState {
  const field = (name: string, message: string): LocationFormState => ({
    status: "error",
    fieldErrors: { [name]: [message] },
    values,
  });

  if (isUniqueViolation(error, "buildings_code_key")) {
    return field("code", "Another building already uses this code.");
  }
  if (isUniqueViolation(error, "buildings_name_key")) {
    return field("name", "Another building already has this name.");
  }
  if (isUniqueViolation(error, "rooms_building_room_number_key")) {
    return field(
      "roomNumber",
      "This building already has a room with this number.",
    );
  }

  let message: string;
  if (isPermissionError(error)) {
    message = `You do not have permission to change this ${subject}.`;
  } else if (
    error.code === PGRST_NO_ROWS ||
    error.code === PG_FOREIGN_KEY_VIOLATION
  ) {
    message = `This ${subject} no longer exists.`;
  } else {
    console.error(
      `[locations] ${subject} write failed:`,
      error.code,
      error.message,
    );
    message = `Unable to save the ${subject}. Please try again.`;
  }
  return { status: "error", message, values };
}

function badId(subject: string): LocationFormState {
  return { status: "error", message: `This ${subject} no longer exists.` };
}

function saved(values: Record<string, string>): LocationFormState {
  return { status: "success", savedAt: Date.now(), values };
}

// --- Buildings -----------------------------------------------------------------

export async function createBuilding(
  _previous: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  await requireRole(["ADMIN"]);
  const values = readFields(formData, ["name", "code", "description"]);

  const parsed = buildingSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error) return failure(error, values, "building");

  revalidatePath(ADMIN_PATH);
  redirect(withFlash(`${ADMIN_PATH}/${data.id}`, "building-created"));
}

export async function updateBuilding(
  buildingId: string,
  _previous: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  await requireRole(["ADMIN"]);
  if (!idSchema.safeParse(buildingId).success) return badId("building");

  const values = readFields(formData, [
    "name",
    "code",
    "description",
    "isActive",
  ]);
  const parsed = buildingUpdateSchema.safeParse({
    ...values,
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return invalid(parsed.error, values);

  const { isActive, ...building } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("buildings")
    .update({ ...building, is_active: isActive })
    .eq("id", buildingId)
    .select("id")
    .single();
  if (error) return failure(error, values, "building");

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${buildingId}`);
  return saved({ ...values, code: building.code });
}

// --- Rooms ---------------------------------------------------------------------

export async function createRoom(
  buildingId: string,
  _previous: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  await requireRole(["ADMIN"]);
  if (!idSchema.safeParse(buildingId).success) return badId("building");

  const values = readFields(formData, ["roomNumber", "displayName"]);
  const parsed = roomSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .insert({
      building_id: buildingId,
      room_number: parsed.data.roomNumber,
      display_name: parsed.data.displayName,
    })
    .select("id")
    .single();
  if (error) return failure(error, values, "room");

  revalidatePath(`${ADMIN_PATH}/${buildingId}`);
  revalidatePath(ADMIN_PATH);
  // No values: the add-room form clears for the next entry.
  return { status: "success", savedAt: Date.now() };
}

export async function updateRoom(
  roomId: string,
  buildingId: string,
  _previous: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  await requireRole(["ADMIN"]);
  if (
    !idSchema.safeParse(roomId).success ||
    !idSchema.safeParse(buildingId).success
  ) {
    return badId("room");
  }

  const values = readFields(formData, [
    "roomNumber",
    "displayName",
    "isActive",
  ]);
  const parsed = roomUpdateSchema.safeParse({
    ...values,
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({
      room_number: parsed.data.roomNumber,
      display_name: parsed.data.displayName,
      is_active: parsed.data.isActive,
    })
    .eq("id", roomId)
    .eq("building_id", buildingId)
    .select("id")
    .single();
  if (error) return failure(error, values, "room");

  revalidatePath(`${ADMIN_PATH}/${buildingId}`);
  return saved(values);
}
