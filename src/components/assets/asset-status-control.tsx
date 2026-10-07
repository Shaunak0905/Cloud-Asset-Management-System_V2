"use client";

import { useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { type AssetStatus, manualStatusTargets } from "@/lib/assets/status";
import type { FormAction } from "@/lib/forms";
import { ASSET_STATUS } from "@/lib/labels";
import { useActionForm } from "@/lib/use-action-form";

/**
 * Admin control for changing an asset's status by hand. Offers only the
 * transitions the database accepts; retiring asks for confirmation.
 */
export function AssetStatusControl({
  status,
  action,
}: {
  status: AssetStatus;
  action: FormAction;
}) {
  const targets = manualStatusTargets(status);
  const [choice, setChoice] = useState<AssetStatus | "">("");
  const [confirming, setConfirming] = useState(false);
  const retireConfirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { state, onSubmit, pending } = useActionForm(action);
  const toast = useToast();

  // After a successful change the page re-renders with the new status, so a
  // previous choice that is no longer offered simply falls away.
  const target = choice && targets.includes(choice) ? choice : "";

  useEffect(() => {
    const saved = state.values?.status as AssetStatus | undefined;
    if (state.savedAt && saved) {
      toast({
        tone: "success",
        title: `Status changed to ${ASSET_STATUS[saved].label}.`,
      });
    }
  }, [state.savedAt, state.values?.status, toast]);

  if (targets.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        {status === "ASSIGNED"
          ? "Assigned assets change status through the assignment workflow (return or transfer)."
          : "Retired assets keep their history and cannot change status."}
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (target === "RETIRED" && !retireConfirmed.current) {
          event.preventDefault();
          setConfirming(true);
          return;
        }
        retireConfirmed.current = false;
        onSubmit(event);
      }}
      className="space-y-3"
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field
        id="asset-new-status"
        label="Change status to"
        error={state.fieldErrors?.status?.[0]}
      >
        <Select
          id="asset-new-status"
          name="status"
          value={target}
          onChange={(event) =>
            setChoice(event.target.value as AssetStatus | "")
          }
        >
          <option value="">Choose a status</option>
          {targets.map((option) => (
            <option key={option} value={option}>
              {ASSET_STATUS[option].label}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        type="submit"
        variant={target === "RETIRED" ? "danger" : "secondary"}
        size="sm"
        disabled={!target || pending}
      >
        {pending
          ? "Updating…"
          : target === "RETIRED"
            ? "Retire asset…"
            : "Update status"}
      </Button>

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title="Retire this asset?"
        description="This will prevent future assignments while preserving its history. Retirement cannot be undone."
        confirmLabel="Retire asset"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          retireConfirmed.current = true;
          setConfirming(false);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
