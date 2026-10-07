"use client";

import { useActionState, useEffect } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldErrorId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateProfile } from "@/lib/profile/actions";
import {
  initialProfileFormState,
  type ProfileValues,
} from "@/lib/profile/state";

export function ProfileForm({ initial }: { initial: ProfileValues }) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialProfileFormState,
  );
  const toast = useToast();

  useEffect(() => {
    if (state.savedAt) {
      toast({ tone: "success", title: "Profile updated" });
    }
  }, [state.savedAt, toast]);

  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};

  const invalid = (field: keyof ProfileValues) =>
    errors[field]
      ? { "aria-invalid": true, "aria-describedby": fieldErrorId(field) }
      : {};

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-5"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field id="fullName" label="Full name" error={errors.fullName?.[0]}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          maxLength={200}
          defaultValue={values.fullName}
          {...invalid("fullName")}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="department"
          label="Department (optional)"
          error={errors.department?.[0]}
        >
          <Input
            id="department"
            name="department"
            autoComplete="organization-title"
            maxLength={100}
            defaultValue={values.department}
            {...invalid("department")}
          />
        </Field>

        <Field id="phone" label="Phone (optional)" error={errors.phone?.[0]}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={30}
            defaultValue={values.phone}
            {...invalid("phone")}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
