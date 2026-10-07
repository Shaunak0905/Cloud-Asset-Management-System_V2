"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { describedBy, Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  type FormState as LocationFormState,
  initialFormState as initialLocationFormState,
} from "@/lib/form-state";

type BuildingFormProps = {
  action: (
    state: LocationFormState,
    formData: FormData,
  ) => Promise<LocationFormState>;
  /** Present when editing an existing building. */
  building?: {
    name: string;
    code: string;
    description: string | null;
    is_active: boolean;
  };
  submitLabel: string;
  cancelHref?: string;
};

const CODE_HINT =
  "1–10 letters or digits, e.g. VY. Shown next to the building name.";

export function BuildingForm({
  action,
  building,
  submitLabel,
  cancelHref,
}: BuildingFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialLocationFormState,
  );
  const toast = useToast();

  useEffect(() => {
    if (state.savedAt) toast({ tone: "success", title: "Building saved." });
  }, [state.savedAt, toast]);

  const values = state.values ?? {
    name: building?.name ?? "",
    code: building?.code ?? "",
    description: building?.description ?? "",
    isActive: building?.is_active === false ? "" : "on",
  };
  const error = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-5"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field id="building-name" label="Name" error={error("name")}>
        <Input
          id="building-name"
          name="name"
          required
          maxLength={100}
          defaultValue={values.name}
          aria-invalid={error("name") ? true : undefined}
          aria-describedby={describedBy("building-name", {
            error: error("name"),
          })}
        />
      </Field>

      <Field
        id="building-code"
        label="Code"
        hint={CODE_HINT}
        error={error("code")}
      >
        <Input
          id="building-code"
          name="code"
          required
          maxLength={10}
          autoCapitalize="characters"
          className="uppercase"
          defaultValue={values.code}
          aria-invalid={error("code") ? true : undefined}
          aria-describedby={describedBy("building-code", {
            hint: CODE_HINT,
            error: error("code"),
          })}
        />
      </Field>

      <Field
        id="building-description"
        label="Description (optional)"
        error={error("description")}
      >
        <Textarea
          id="building-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={values.description}
          aria-invalid={error("description") ? true : undefined}
          aria-describedby={describedBy("building-description", {
            error: error("description"),
          })}
        />
      </Field>

      {building && (
        <Checkbox
          id="building-active"
          name="isActive"
          label="Active"
          hint="Inactive buildings cannot be chosen for new assets or requests. Existing records keep their location."
          defaultChecked={values.isActive === "on"}
        />
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {cancelHref && (
          <Link
            href={cancelHref}
            className={buttonClasses({ variant: "secondary" })}
          >
            Cancel
          </Link>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
