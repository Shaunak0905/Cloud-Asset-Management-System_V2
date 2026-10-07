import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Tone = "error" | "warning" | "info" | "success";

const TONES: Record<Tone, { box: string; label: string }> = {
  error: { box: "border-red-200 bg-red-50 text-red-900", label: "Error" },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-950",
    label: "Warning",
  },
  info: { box: "border-blue-200 bg-blue-50 text-blue-950", label: "Note" },
  success: {
    box: "border-green-200 bg-green-50 text-green-900",
    label: "Success",
  },
};

type AlertProps = {
  tone?: Tone;
  /** Visible heading; defaults to a label for the tone so meaning never relies on color. */
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: AlertProps) {
  const style = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        style.box,
        className,
      )}
    >
      <p className="font-medium">{title ?? style.label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
