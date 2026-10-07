"use client";

import { useActionState, useCallback, useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { describedBy, Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  type FormState as LocationFormState,
  initialFormState as initialLocationFormState,
} from "@/lib/form-state";

type Room = {
  id: string;
  room_number: string;
  display_name: string | null;
  is_active: boolean;
};

type RoomAction = (
  state: LocationFormState,
  formData: FormData,
) => Promise<LocationFormState>;

/** "Edit" button that opens a dialog for one room. */
export function EditRoomButton({
  room,
  action,
}: {
  room: Room;
  action: RoomAction;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        Edit<span className="sr-only"> room {room.room_number}</span>
      </Button>
      <Modal
        open={open}
        title={`Edit room ${room.room_number}`}
        onClose={close}
      >
        {/* Mounted only while open, so each opening starts with a fresh form. */}
        {open && <EditRoomForm room={room} action={action} onDone={close} />}
      </Modal>
    </>
  );
}

function EditRoomForm({
  room,
  action,
  onDone,
}: {
  room: Room;
  action: RoomAction;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialLocationFormState,
  );
  const toast = useToast();

  useEffect(() => {
    if (state.savedAt) {
      toast({ tone: "success", title: "Room updated." });
      onDone();
    }
  }, [state.savedAt, toast, onDone]);

  const values = state.values ?? {
    roomNumber: room.room_number,
    displayName: room.display_name ?? "",
    isActive: room.is_active ? "on" : "",
  };
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const prefix = `edit-room-${room.id}`;

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-4"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field
        id={`${prefix}-number`}
        label="Room number"
        error={error("roomNumber")}
      >
        <Input
          id={`${prefix}-number`}
          name="roomNumber"
          required
          maxLength={20}
          defaultValue={values.roomNumber}
          aria-invalid={error("roomNumber") ? true : undefined}
          aria-describedby={describedBy(`${prefix}-number`, {
            error: error("roomNumber"),
          })}
        />
      </Field>
      <Field
        id={`${prefix}-name`}
        label="Name (optional)"
        error={error("displayName")}
      >
        <Input
          id={`${prefix}-name`}
          name="displayName"
          maxLength={100}
          defaultValue={values.displayName}
          aria-invalid={error("displayName") ? true : undefined}
          aria-describedby={describedBy(`${prefix}-name`, {
            error: error("displayName"),
          })}
        />
      </Field>
      <Checkbox
        id={`${prefix}-active`}
        name="isActive"
        label="Active"
        hint="Inactive rooms cannot be chosen for new assets or requests."
        defaultChecked={values.isActive === "on"}
      />

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save room"}
        </Button>
      </div>
    </form>
  );
}
