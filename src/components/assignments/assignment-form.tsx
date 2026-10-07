"use client";

import Link from "next/link";

import { BuildingRoomSelector } from "@/components/locations/building-room-selector";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import type { FormAction } from "@/lib/forms";
import type { BuildingOption } from "@/lib/locations/types";
import { useActionForm } from "@/lib/use-action-form";

const RETURN_HINT = "Optional. Campus time.";
const EMAIL_HINT = "The email address they sign in with.";

/**
 * Where an asset will be used, and until when (docs/10 §18). Used by people
 * requesting an asset for themselves and, with `withRecipient`, by admins
 * assigning or transferring it to someone else. Submits through
 * useActionForm so a validation error never clears the chosen building/room.
 */
export function AssignmentForm({
  action,
  buildings,
  minReturn,
  cancelHref,
  withRecipient = false,
  locationLegend = "Where will you use it?",
  submitLabel = "Submit request",
}: {
  action: FormAction;
  buildings: BuildingOption[];
  /** Earliest selectable return time (now, campus time) for the picker. */
  minReturn: string;
  cancelHref: string;
  /** Ask who receives the asset (admin assign/transfer). */
  withRecipient?: boolean;
  locationLegend?: string;
  submitLabel?: string;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const error = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}

      {withRecipient && (
        <Field
          id="recipient-email"
          label="Assign to"
          hint={EMAIL_HINT}
          error={error("userEmail")}
        >
          <Input
            id="recipient-email"
            name="userEmail"
            type="email"
            autoComplete="off"
            placeholder="name@example.edu"
            aria-invalid={error("userEmail") ? true : undefined}
            aria-describedby={describedBy("recipient-email", {
              hint: EMAIL_HINT,
              error: error("userEmail"),
            })}
          />
        </Field>
      )}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">
          {locationLegend}
        </legend>
        <BuildingRoomSelector
          idPrefix="usage"
          buildings={buildings}
          buildingFieldName="buildingId"
          roomFieldName="roomId"
          buildingLabel="Building"
          roomLabel="Room"
          errors={{ building: error("buildingId"), room: error("roomId") }}
        />
      </fieldset>

      <Field
        id="expected-return"
        label="Expected return"
        hint={RETURN_HINT}
        error={error("expectedReturn")}
      >
        <Input
          id="expected-return"
          name="expectedReturn"
          type="datetime-local"
          min={minReturn}
          aria-invalid={error("expectedReturn") ? true : undefined}
          aria-describedby={describedBy("expected-return", {
            hint: RETURN_HINT,
            error: error("expectedReturn"),
          })}
        />
      </Field>

      <Field id="request-notes" label="Notes (optional)" error={error("notes")}>
        <Textarea
          id="request-notes"
          name="notes"
          rows={3}
          maxLength={1000}
          placeholder="e.g. Guest lecture in VK404"
          aria-invalid={error("notes") ? true : undefined}
          aria-describedby={describedBy("request-notes", {
            error: error("notes"),
          })}
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className={buttonClasses({ variant: "secondary" })}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
