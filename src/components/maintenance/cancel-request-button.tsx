"use client";

import { Ban } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { FormAction } from "@/lib/forms";
import { useActionFormWithSuccess } from "@/lib/use-action-form";
import type { Enums } from "@/types/database";

const REASON_HINT =
  "For example, a duplicate of another report. The person who reported it sees this.";

/**
 * Admin: cancel an OPEN or ASSIGNED request (docs/08 §29) with a reason. The
 * request and its history are kept. The button disappears once the request
 * is cancelled, so the toast is shown from the submission.
 */
export function CancelRequestButton({
  action,
  assetStatus,
}: {
  action: FormAction;
  /** The asset's status now, to say when cancelling releases it. */
  assetStatus: Enums<"asset_status">;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { state, onSubmit, pending } = useActionFormWithSuccess(
    action,
    (result) => {
      setOpen(false);
      const released =
        assetStatus === "IN_MAINTENANCE" &&
        result.values?.assetStatus === "AVAILABLE";
      toast({
        tone: "success",
        title: released
          ? "Request cancelled. The asset is available again."
          : "Request cancelled.",
      });
    },
  );
  const error = state.fieldErrors?.reason?.[0];

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Ban aria-hidden className="size-4" />
        Cancel request
      </Button>
      <Modal
        open={open}
        title="Cancel this request?"
        description="Use this for duplicates or reports that need no repair. The request and its history are kept."
        onClose={() => setOpen(false)}
        dismissible={!pending}
      >
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {state.message && <Alert tone="error">{state.message}</Alert>}
          <Field
            id="cancel-reason"
            label="Reason"
            hint={REASON_HINT}
            error={error}
          >
            <Textarea
              id="cancel-reason"
              name="reason"
              rows={3}
              maxLength={500}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy("cancel-reason", {
                hint: REASON_HINT,
                error,
              })}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Keep request
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Cancelling…" : "Cancel request"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
