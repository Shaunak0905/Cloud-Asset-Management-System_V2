"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { FormAction } from "@/lib/forms";
import { useActionForm } from "@/lib/use-action-form";

export type TechnicianChoice = {
  id: string;
  full_name: string;
  email: string | null;
};

function technicianLabel(technician: TechnicianChoice): string {
  return technician.email
    ? `${technician.full_name} (${technician.email})`
    : technician.full_name;
}

/**
 * Admin: choose the technician for a request (docs/08 §16–17). Lists only
 * active technicians; the database checks the choice again. With a current
 * technician it becomes "reassign" and leaves them out of the list.
 */
export function AssignTechnicianForm({
  action,
  technicians,
  currentTechnicianId,
}: {
  action: FormAction;
  technicians: TechnicianChoice[];
  currentTechnicianId: string | null;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const [choice, setChoice] = useState("");
  const toast = useToast();
  const options = technicians.filter((t) => t.id !== currentTechnicianId);
  const reassigning = currentTechnicianId !== null;
  const error = state.fieldErrors?.technicianId?.[0];

  // After a save the chosen technician becomes the current one and leaves the
  // list, so the previous choice simply falls away.
  const selected = options.some((t) => t.id === choice) ? choice : "";

  useEffect(() => {
    if (state.savedAt) {
      toast({ tone: "success", title: "Technician assigned." });
    }
  }, [state.savedAt, toast]);

  if (options.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        {reassigning
          ? "There is no other active technician to hand this request to."
          : "There are no active technicians yet. Give a user the Technician role first."}
      </p>
    );
  }

  const hint = reassigning
    ? "The new technician continues from the current step."
    : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3">
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field
        id="technician"
        label={reassigning ? "Hand over to" : "Technician"}
        hint={hint}
        error={error}
      >
        <Select
          id="technician"
          name="technicianId"
          value={selected}
          onChange={(event) => setChoice(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("technician", { hint, error })}
        >
          <option value="">Choose a technician</option>
          {options.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technicianLabel(technician)}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        type="submit"
        size="sm"
        variant={reassigning ? "secondary" : "primary"}
        disabled={!selected || pending}
      >
        {pending ? "Saving…" : reassigning ? "Reassign" : "Assign technician"}
      </Button>
    </form>
  );
}
