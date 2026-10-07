"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

import {
  profileSchema,
  type ProfileFormState,
  type ProfileValues,
} from "./schema";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Updates the signed-in user's own contact details (never role or status). */
export async function updateProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  // Server Actions are public endpoints: authenticate on every call.
  const user = await requireUser();

  const values: ProfileValues = {
    fullName: text(formData, "fullName"),
    department: text(formData, "department"),
    phone: text(formData, "phone"),
  };

  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      department: parsed.data.department,
      phone: parsed.data.phone,
    })
    .eq("id", user.id)
    .select("id")
    .single();

  if (error) {
    console.error("[profile] update failed:", error.code, error.message);
    return {
      status: "error",
      message: "Unable to save your profile. Please try again.",
      values,
    };
  }

  // The name also appears in the navigation shell.
  revalidatePath("/", "layout");
  return {
    status: "success",
    savedAt: Date.now(),
    values: {
      fullName: parsed.data.fullName,
      department: parsed.data.department ?? "",
      phone: parsed.data.phone ?? "",
    },
  };
}
