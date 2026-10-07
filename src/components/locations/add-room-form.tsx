"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  type FormState as LocationFormState,
  initialFormState as initialLocationFormState,
} from "@/lib/form-state";

type AddRoomFormProps = {
  action: (
    state: LocationFormState,
    formData: FormData,
  ) => Promise<LocationFormState>;
};

/** Inline form above the room list; clears itself after each added room. */
export function AddRoomForm({ action }: AddRoomFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    initialLocationFormState,
  );
  const toast = useToast();

  useEffect(() => {
    if (state.savedAt) toast({ tone: "success", title: "Room added." });
  }, [state.savedAt, toast]);

  const values = state.values ?? { roomNumber: "", displayName: "" };
  const error = (field: string) => state.fieldErrors?.[field]?.[0];

  return (
    <form
      action={formAction}
      noValidate
      aria-busy={pending}
      aria-label="Add room"
      className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4"
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start">
        <Field
          id="new-room-number"
          label="Room number"
          error={error("roomNumber")}
        >
          <Input
            id="new-room-number"
            name="roomNumber"
            required
            maxLength={20}
            placeholder="VY101"
            defaultValue={values.roomNumber}
            aria-invalid={error("roomNumber") ? true : undefined}
            aria-describedby={describedBy("new-room-number", {
              error: error("roomNumber"),
            })}
          />
        </Field>
        <Field
          id="new-room-name"
          label="Name (optional)"
          error={error("displayName")}
        >
          <Input
            id="new-room-name"
            name="displayName"
            maxLength={100}
            placeholder="Computer Lab 1"
            defaultValue={values.displayName}
            aria-invalid={error("displayName") ? true : undefined}
            aria-describedby={describedBy("new-room-name", {
              error: error("displayName"),
            })}
          />
        </Field>
        <Button type="submit" disabled={pending} className="sm:mt-7">
          <Plus aria-hidden className="size-4" />
          {pending ? "Adding…" : "Add room"}
        </Button>
      </div>
    </form>
  );
}
