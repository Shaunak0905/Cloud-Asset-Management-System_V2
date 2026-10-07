"use client";

import { useEffect, useRef } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { FormAction } from "@/lib/forms";
import { MAINTENANCE_ACTION } from "@/lib/labels";
import { WORK_NOTE_ACTIONS } from "@/lib/maintenance/options";
import { useActionForm } from "@/lib/use-action-form";

const NOTES_HINT =
  "What you found, did, replaced or tested. Only admins and the assigned technician see these notes.";

/**
 * Adds an entry to the request's work log (docs/08 §19). Submits through
 * useActionForm, so a rejected note keeps what was typed; a saved one clears
 * the form.
 */
export function WorkNoteForm({ action }: { action: FormAction }) {
  const { state, onSubmit, pending } = useActionForm(action);
  const formRef = useRef<HTMLFormElement>(null);
  const toast = useToast();
  const error = (field: string) => state.fieldErrors?.[field]?.[0];

  useEffect(() => {
    if (state.savedAt) {
      formRef.current?.reset();
      toast({ tone: "success", title: "Note added." });
    }
  }, [state.savedAt, toast]);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="space-y-4"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field id="note-action" label="Entry type" error={error("action")}>
        <Select
          id="note-action"
          name="action"
          defaultValue="NOTE"
          aria-invalid={error("action") ? true : undefined}
          aria-describedby={describedBy("note-action", {
            error: error("action"),
          })}
          className="sm:max-w-xs"
        >
          {WORK_NOTE_ACTIONS.map((action) => (
            <option key={action} value={action}>
              {MAINTENANCE_ACTION[action]}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        id="note-text"
        label="Note"
        hint={NOTES_HINT}
        error={error("notes")}
      >
        <Textarea
          id="note-text"
          name="notes"
          rows={3}
          maxLength={2000}
          required
          aria-invalid={error("notes") ? true : undefined}
          aria-describedby={describedBy("note-text", {
            hint: NOTES_HINT,
            error: error("notes"),
          })}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
