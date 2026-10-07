"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/actions";
import { initialSignInState } from "@/lib/auth/sign-in-state";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    signIn,
    initialSignInState,
  );
  const emailError = state.fieldErrors?.email?.[0];
  const passwordError = state.fieldErrors?.password?.[0];

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-5"
      aria-busy={pending}
    >
      {next && <input type="hidden" name="next" value={next} />}

      {state.message && (
        <Alert tone="error" title="Sign-in failed">
          {state.message}
        </Alert>
      )}

      <Field id="email" label="Email" error={emailError}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? fieldErrorId("email") : undefined}
        />
      </Field>

      <Field id="password" label="Password" error={passwordError}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={
            passwordError ? fieldErrorId("password") : undefined
          }
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
