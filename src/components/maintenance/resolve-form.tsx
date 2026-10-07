"use client";

import { useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { describedBy, Field, fieldErrorId } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { FormAction } from "@/lib/forms";
import {
  RESOLUTION_STATE_OPTIONS,
  type ResolutionAssetState,
  resolutionAssetStates,
  resolvedMessage,
  unchangedAssetExplanation,
} from "@/lib/maintenance/resolution";
import { useActionFormWithSuccess } from "@/lib/use-action-form";
import { cn } from "@/lib/utils/cn";
import type { Enums } from "@/types/database";

type AssetStatus = Enums<"asset_status">;

const NOTES_HINT =
  "The person who reported the problem sees this, so write it plainly.";

/**
 * Resolve a request (docs/08 §26–28, docs/10 §22): what was done, and the
 * asset's final state from the choices the database accepts for it. Retiring
 * asks for confirmation. The form disappears once the request is resolved,
 * so the confirmation toast is shown from the submission.
 */
export function ResolveForm({
  action,
  assetStatus,
  isAdmin,
}: {
  action: FormAction;
  assetStatus: AssetStatus;
  isAdmin: boolean;
}) {
  const toast = useToast();
  const { state, onSubmit, pending } = useActionFormWithSuccess(
    action,
    (result) =>
      toast({
        tone: "success",
        title: resolvedMessage(
          result.values?.assetStatus as AssetStatus | undefined,
        ),
      }),
  );
  const choices = resolutionAssetStates(assetStatus, isAdmin);
  const [choice, setChoice] = useState<ResolutionAssetState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const retireConfirmed = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const error = (field: string) => state.fieldErrors?.[field]?.[0];
  const stateError = error("assetStatus");
  // A choice that is no longer offered (the asset changed) falls away.
  const selected = choice && choices?.includes(choice) ? choice : null;

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (selected === "RETIRED" && !retireConfirmed.current) {
          event.preventDefault();
          setConfirming(true);
          return;
        }
        retireConfirmed.current = false;
        onSubmit(event);
      }}
      noValidate
      className="space-y-5"
      aria-busy={pending}
    >
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field
        id="resolution-notes"
        label="What was done?"
        hint={NOTES_HINT}
        error={error("resolutionNotes")}
      >
        <Textarea
          id="resolution-notes"
          name="resolutionNotes"
          rows={4}
          maxLength={4000}
          required
          aria-invalid={error("resolutionNotes") ? true : undefined}
          aria-describedby={describedBy("resolution-notes", {
            hint: NOTES_HINT,
            error: error("resolutionNotes"),
          })}
        />
      </Field>

      {choices ? (
        <fieldset
          aria-describedby={
            stateError ? fieldErrorId("resolution-state") : undefined
          }
          aria-invalid={stateError ? true : undefined}
        >
          <legend className="text-sm font-medium text-slate-900">
            What state is the asset in now?
          </legend>
          <div
            className={cn(
              "mt-2 grid grid-cols-1 gap-2",
              choices.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            {choices.map((value) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm",
                  selected === value
                    ? value === "RETIRED"
                      ? "border-red-600 bg-red-50"
                      : "border-blue-600 bg-blue-50"
                    : "border-slate-300 hover:bg-slate-50",
                )}
              >
                <input
                  type="radio"
                  name="assetStatus"
                  value={value}
                  checked={selected === value}
                  onChange={() => setChoice(value)}
                  aria-labelledby={`resolution-${value}-label`}
                  aria-describedby={`resolution-${value}-hint`}
                  className="mt-0.5 size-4 shrink-0 accent-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                />
                <span>
                  <span
                    id={`resolution-${value}-label`}
                    className="font-medium text-slate-900"
                  >
                    {RESOLUTION_STATE_OPTIONS[value].label}
                  </span>
                  <span
                    id={`resolution-${value}-hint`}
                    className="block text-slate-600"
                  >
                    {RESOLUTION_STATE_OPTIONS[value].hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
          {stateError && (
            <p
              id={fieldErrorId("resolution-state")}
              className="mt-1.5 text-sm text-red-700"
            >
              {stateError}
            </p>
          )}
        </fieldset>
      ) : (
        <Alert tone="info">{unchangedAssetExplanation(assetStatus)}</Alert>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          variant={selected === "RETIRED" ? "danger" : "primary"}
          disabled={pending || (choices !== null && !selected)}
        >
          {pending ? "Resolving…" : "Resolve request"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title="Retire this asset?"
        description="The request is resolved and the asset is retired, so it can no longer be requested. Retirement cannot be undone; the asset keeps its history."
        confirmLabel="Resolve and retire"
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
