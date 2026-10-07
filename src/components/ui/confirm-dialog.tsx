"use client";

import type { ReactNode } from "react";

import { Button } from "./button";
import { Modal } from "./modal";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Explain the consequence of confirming (docs/10 §33). */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  /** Disables both buttons while the confirmed action runs. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal confirmation for destructive or important actions. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      dismissible={!pending}
    >
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
