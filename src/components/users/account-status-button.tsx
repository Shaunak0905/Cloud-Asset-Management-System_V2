"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

/**
 * Admin: deactivate or reactivate an account, after confirming (docs/05 §8).
 * Nothing is deleted: a deactivated user keeps their history but cannot use
 * the app until reactivated.
 */
export function AccountStatusButton({
  action,
  active,
  userName,
}: {
  action: () => Promise<FormState>;
  /** Whether the account is active now. */
  active: boolean;
  userName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      setConfirming(false);
      toast(
        result.status === "success"
          ? {
              tone: "success",
              title: active ? "Account deactivated." : "Account reactivated.",
            }
          : {
              tone: "error",
              title: result.message ?? "Unable to change the account.",
            },
      );
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant={active ? "ghost" : "secondary"}
        onClick={() => setConfirming(true)}
        disabled={pending}
        aria-label={`${active ? "Deactivate" : "Reactivate"} ${userName}`}
      >
        {active ? "Deactivate" : "Reactivate"}
      </Button>
      <ConfirmDialog
        open={confirming}
        tone={active ? "danger" : "primary"}
        title={active ? `Deactivate ${userName}?` : `Reactivate ${userName}?`}
        description={
          active
            ? 'They will no longer be able to use the app; signing in shows an "account inactive" page. Their history is kept, and you can reactivate them at any time.'
            : "They will be able to sign in and use the app again with their current role."
        }
        confirmLabel={active ? "Deactivate" : "Reactivate"}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
      />
    </>
  );
}
