"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { describedBy, Field, fieldErrorId } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import type { FormAction } from "@/lib/forms";
import { MAINTENANCE_PRIORITY } from "@/lib/labels";
import {
  OUT_OF_SERVICE_PRIORITIES,
  PRIORITY_GUIDANCE,
} from "@/lib/maintenance/options";
import type { MaintenancePriority } from "@/lib/maintenance/schema";
import { cn } from "@/lib/utils/cn";
import { useActionForm } from "@/lib/use-action-form";
import { Constants, type Enums } from "@/types/database";

const DESCRIPTION_HINT =
  "What happens, and when? For example: “Powers on but shows no image.”";

/**
 * Report a problem (docs/08 §4, docs/10 §19). The asset comes from the page
 * and the reporter from the session, so the form asks only what is wrong
 * and how serious it is. Submits through useActionForm so nothing typed is
 * lost if the server rejects it.
 */
export function ReportProblemForm({
  action,
  assetStatus,
  cancelHref,
}: {
  action: FormAction;
  assetStatus: Enums<"asset_status">;
  cancelHref: string;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const [priority, setPriority] = useState<MaintenancePriority | null>(null);
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const priorityError = error("priority");
  const outOfService = priority && OUT_OF_SERVICE_PRIORITIES.includes(priority);

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-5"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field
        id="problem-description"
        label="What is the problem?"
        hint={DESCRIPTION_HINT}
        error={error("description")}
      >
        <Textarea
          id="problem-description"
          name="description"
          rows={5}
          maxLength={2000}
          required
          aria-invalid={error("description") ? true : undefined}
          aria-describedby={describedBy("problem-description", {
            hint: DESCRIPTION_HINT,
            error: error("description"),
          })}
        />
      </Field>

      <fieldset
        aria-describedby={
          priorityError ? fieldErrorId("problem-priority") : undefined
        }
        aria-invalid={priorityError ? true : undefined}
      >
        <legend className="text-sm font-medium text-slate-900">
          How serious is it?
        </legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Constants.public.Enums.maintenance_priority.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm",
                priority === value
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-300 hover:bg-slate-50",
              )}
            >
              <input
                type="radio"
                name="priority"
                value={value}
                required
                onChange={() => setPriority(value)}
                aria-labelledby={`priority-${value}-label`}
                aria-describedby={`priority-${value}-hint`}
                className="mt-0.5 size-4 shrink-0 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              />
              <span>
                <span
                  id={`priority-${value}-label`}
                  className="font-medium text-slate-900"
                >
                  {MAINTENANCE_PRIORITY[value].label}
                </span>
                <span
                  id={`priority-${value}-hint`}
                  className="block text-slate-600"
                >
                  {PRIORITY_GUIDANCE[value]}
                </span>
              </span>
            </label>
          ))}
        </div>
        {priorityError && (
          <p
            id={fieldErrorId("problem-priority")}
            className="mt-1.5 text-sm text-red-700"
          >
            {priorityError}
          </p>
        )}
      </fieldset>

      {outOfService && assetStatus === "AVAILABLE" && (
        <Alert tone="info">
          The asset will be marked <strong>In maintenance</strong> so nobody
          takes it until it is repaired.
        </Alert>
      )}
      {outOfService && assetStatus === "ASSIGNED" && (
        <Alert tone="info">
          It stays with the person using it. When it is returned it goes to
          maintenance instead of back into use.
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className={buttonClasses({ variant: "secondary" })}
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Submit report"}
        </Button>
      </div>
    </form>
  );
}
