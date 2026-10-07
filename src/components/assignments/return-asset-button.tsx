"use client";

import { Undo2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

/**
 * "Return asset" with a confirmation step. The page refreshes with the
 * returned state; the toast lives in the app shell, so it still shows after
 * this button disappears.
 */
export function ReturnAssetButton({
  action,
  assetName,
  onBehalfOf,
  size = "md",
}: {
  action: () => Promise<FormState>;
  assetName: string;
  /** Set when an admin returns someone else's asset. */
  onBehalfOf?: string;
  size?: "sm" | "md";
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  function confirm() {
    startTransition(async () => {
      const result = await action();
      setConfirming(false);
      if (result.status === "success") {
        toast({
          tone: "success",
          title: "Asset returned. It is available again.",
        });
      } else {
        toast({
          tone: "error",
          title: result.message ?? "Unable to return the asset.",
        });
      }
    });
  }

  return (
    <>
      <Button
        variant="secondary"
        size={size}
        onClick={() => setConfirming(true)}
        disabled={pending}
      >
        <Undo2 aria-hidden className="size-4" />
        Return asset
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Return this asset?"
        description={
          onBehalfOf
            ? `This ends ${onBehalfOf}'s use of ${assetName} and makes it available to others. Do this once the asset is back.`
            : `${assetName} will become available to others. Make sure you have handed it back.`
        }
        confirmLabel="Return asset"
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
      />
    </>
  );
}
