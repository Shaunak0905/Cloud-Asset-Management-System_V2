"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils/cn";

type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastItem = Required<Pick<ToastInput, "title" | "tone">> &
  Pick<ToastInput, "description"> & { id: number };

export const TOAST_DURATION_MS = 5000;
const MAX_VISIBLE = 3;

const TONES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: "text-green-700" },
  error: { icon: CircleAlert, className: "text-red-700" },
  info: { icon: Info, className: "text-blue-700" },
};

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Shows short success/error feedback after an action (docs/10 §32). */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setToasts((current) => [
      ...current.slice(-(MAX_VISIBLE - 1)),
      {
        id,
        title: toast.title,
        description: toast.description,
        tone: toast.tone ?? "info",
      },
    ]);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end print:hidden"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  );
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const { icon: Icon, className } = TONES[toast.tone];
  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", className)} />
      <div className="flex-1 text-sm">
        <p className="font-medium text-slate-900">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-slate-600">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-sm text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        <X aria-hidden className="size-4" />
        <span className="sr-only">Dismiss notification</span>
      </button>
    </div>
  );
}
