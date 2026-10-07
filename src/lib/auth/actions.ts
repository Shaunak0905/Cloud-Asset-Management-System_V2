"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { LOGIN_PATH, postLoginPath } from "./routes";
import {
  SIGN_IN_MESSAGES,
  signInErrorMessage,
  signInSchema,
  type SignInState,
} from "./sign-in";

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";

  const parsed = signInSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { email, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code !== "invalid_credentials") {
      console.error(
        "[auth] sign-in failed:",
        error.code ?? error.name,
        error.status,
      );
    }
    return { email, message: signInErrorMessage(error) };
  }

  // The session now exists; confirm the account may use the application.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile || !profile.is_active) {
    if (profileError) {
      console.error("[auth] profile lookup failed:", profileError.code);
    }
    await supabase.auth.signOut({ scope: "local" });
    return {
      email,
      message: profileError
        ? SIGN_IN_MESSAGES.unavailable
        : profile
          ? SIGN_IN_MESSAGES.inactive
          : SIGN_IN_MESSAGES.noProfile,
    };
  }

  revalidatePath("/", "layout");
  redirect(postLoginPath(profile.role, formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Clears the local session even if the Auth API cannot be reached.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) {
    console.error("[auth] sign-out API call failed:", error.code ?? error.name);
  }
  revalidatePath("/", "layout");
  redirect(LOGIN_PATH);
}
