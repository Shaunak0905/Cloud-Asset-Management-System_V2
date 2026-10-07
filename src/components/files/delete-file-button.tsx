"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

/**
 * Admin: delete a stored file after confirming (docs/09 §26). The deletion
 * is permanent and audited. The toast lives in the app shell, so it still
 * shows after the file (and this button) disappears from the page.
 */
export function DeleteFileButton({
  action,
  fileName,
  label = "Delete",
}: {
  action: () => Promise<FormState>;
  fileName: string;
  label?: string;
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
          ? { tone: "success", title: "File deleted." }
          : {
              tone: "error",
              title: result.message ?? "Unable to delete the file.",
            },
      );
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={pending}
        aria-label={`${label} ${fileName}`}
      >
        <Trash2 aria-hidden className="size-4" />
        {label}
      </Button>
      <ConfirmDialog
        open={confirming}
        tone="danger"
        title="Delete this file?"
        description={`${fileName} will be deleted permanently. This cannot be undone.`}
        confirmLabel="Delete file"
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
      />
    </>
  );
}
