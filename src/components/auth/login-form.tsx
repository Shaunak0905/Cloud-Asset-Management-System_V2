"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const emailError = state.fieldErrors?.email?.[0];
  const passwordError = state.fieldErrors?.password?.[0];

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-4"
      aria-busy={pending}
    >
      {next && <input type="hidden" name="next" value={next} />}

      {state.message && (
        <Alert tone="error" title="Sign-in failed">
          {state.message}
        </Alert>
      )}

      <Field id="email" label="Email" error={emailError}>
        <div className="relative">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="e.g. admin@example.com"
            required
            defaultValue={state.email}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? fieldErrorId("email") : undefined}
            className="pl-10 transition-colors focus:border-blue-600"
          />
          <Mail
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
        </div>
      </Field>

      <Field id="password" label="Password" error={passwordError}>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            required
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={
              passwordError ? fieldErrorId("password") : undefined
            }
            className="pr-10 pl-10 transition-colors focus:border-blue-600"
          />
          <Lock
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-blue-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        </div>
      </Field>

      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-xs transition-all hover:from-blue-800 hover:to-indigo-800 hover:shadow"
        disabled={pending}
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            <span>Signing in…</span>
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span>Sign in</span>
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        )}
      </Button>
    </form>
  );
}
