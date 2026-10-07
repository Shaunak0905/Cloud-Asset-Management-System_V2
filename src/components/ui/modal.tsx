"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** When false, Escape and backdrop clicks do nothing (e.g. while saving). */
  dismissible?: boolean;
  children: ReactNode;
};

/**
 * Modal dialog built on the native <dialog> element, which provides focus
 * trapping and Escape handling. React state stays in charge of open/closed.
 */
export function Modal({
  open,
  title,
  description,
  onClose,
  dismissible = true,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      // A click on the backdrop lands on the <dialog> element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="mt-2 text-sm text-slate-600">
            {description}
          </div>
        )}
        <div className={description ? "mt-6" : "mt-4"}>{children}</div>
      </div>
    </dialog>
  );
}
