import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { SIGN_IN_MESSAGES, signInErrorMessage, signInSchema } from "./sign-in";

describe("signInSchema", () => {
  it("accepts_a_valid_email_and_password_and_trims_the_email", () => {
    expect(
      signInSchema.parse({
        email: "  student@campus.edu ",
        password: "secret",
      }),
    ).toEqual({ email: "student@campus.edu", password: "secret" });
  });

  it.each([
    [{ email: "", password: "x" }, "email", "Enter your email address."],
    [
      { email: "not-an-email", password: "x" },
      "email",
      "Enter a valid email address.",
    ],
    [{ email: "a@b.co", password: "" }, "password", "Enter your password."],
  ])("rejects_%o", (input, field, message) => {
    const result = signInSchema.safeParse(input);
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find((i) => i.path[0] === field);
    expect(issue?.message).toBe(message);
  });
});

describe("signInErrorMessage", () => {
  it.each([
    [
      new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
      SIGN_IN_MESSAGES.invalidCredentials,
    ],
    [
      new AuthApiError("Email not confirmed", 400, "email_not_confirmed"),
      SIGN_IN_MESSAGES.emailNotConfirmed,
    ],
    [
      new AuthApiError("Too many requests", 429, "over_request_rate_limit"),
      SIGN_IN_MESSAGES.rateLimited,
    ],
    [
      new AuthApiError("User is banned", 400, "user_banned"),
      SIGN_IN_MESSAGES.inactive,
    ],
    [
      new AuthApiError("Rate limited", 429, undefined),
      SIGN_IN_MESSAGES.rateLimited,
    ],
    [
      new AuthApiError("Server error", 500, "unexpected_failure"),
      SIGN_IN_MESSAGES.unavailable,
    ],
    [
      new AuthRetryableFetchError("fetch failed", 0),
      SIGN_IN_MESSAGES.unavailable,
    ],
    [
      new AuthApiError("Something odd", 400, "validation_failed"),
      SIGN_IN_MESSAGES.invalidCredentials,
    ],
  ])("maps_%s", (error, expected) => {
    expect(signInErrorMessage(error)).toBe(expected);
  });

  it("never_returns_the_raw_provider_message", () => {
    const error = new AuthApiError(
      "SELECT * FROM auth.users failed",
      500,
      "unexpected_failure",
    );
    expect(signInErrorMessage(error)).not.toContain("auth.users");
  });
});
