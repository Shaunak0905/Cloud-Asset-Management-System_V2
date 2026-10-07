import {
  isAuthRetryableFetchError,
  type AuthError,
} from "@supabase/supabase-js";
import { z } from "zod";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

export {
  initialSignInState,
  type SignInFieldErrors,
  type SignInState,
} from "./sign-in-state";

export const SIGN_IN_MESSAGES = {
  invalidCredentials:
    "Unable to sign in. Please check your email and password.",
  emailNotConfirmed:
    "Please confirm your email address before signing in, or contact an administrator.",
  rateLimited: "Too many sign-in attempts. Please wait a moment and try again.",
  unavailable:
    "Unable to reach the sign-in service. Please check your connection and try again.",
  inactive:
    "Your account is currently inactive. Please contact an administrator.",
  noProfile:
    "Your account has not been set up yet. Please contact an administrator.",
} as const;

/** Maps a Supabase Auth error to a safe, user-facing message. */
export function signInErrorMessage(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) return SIGN_IN_MESSAGES.unavailable;

  switch (error.code) {
    case "invalid_credentials":
      return SIGN_IN_MESSAGES.invalidCredentials;
    case "email_not_confirmed":
      return SIGN_IN_MESSAGES.emailNotConfirmed;
    case "over_request_rate_limit":
      return SIGN_IN_MESSAGES.rateLimited;
    case "user_banned":
      return SIGN_IN_MESSAGES.inactive;
  }

  if (error.status === 429) return SIGN_IN_MESSAGES.rateLimited;
  if (error.status !== undefined && error.status >= 500) {
    return SIGN_IN_MESSAGES.unavailable;
  }
  return SIGN_IN_MESSAGES.invalidCredentials;
}
