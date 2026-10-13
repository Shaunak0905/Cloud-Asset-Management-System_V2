import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "warning" | "danger";

const VALUE_TONES: Record<Tone, string> = {
  neutral: "text-slate-900",
  warning: "text-amber-700",
  danger: "text-red-700",
};

/**
 * One dashboard number with what it counts (docs/12 §52: "42 Assets", not
 * "42"). Links to the matching list when there is a meaningful one
 * (docs/12 §53). `tone` highlights numbers that need attention — only when
 * they are above zero, so a calm dashboard stays calm. `display` replaces
 * the shown number when it needs formatting (e.g. "86%", or "—" for none).
 */
export function StatCard({
  label,
  value,
  display,
  href,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  display?: string;
  href?: string;
  hint?: string;
  tone?: Tone;
}) {
  const content = (
    <>
      <span className="block text-sm text-slate-600">{label}</span>
      <span
        className={cn(
          "mt-1 block text-2xl font-semibold tabular-nums",
          VALUE_TONES[value > 0 ? tone : "neutral"],
        )}
      >
        {display ?? value}
      </span>
      {hint && (
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      )}
    </>
  );
  const box = "block rounded-lg border border-slate-200 bg-white p-4 shadow-xs";

  return href ? (
    <Link
      href={href}
      className={cn(
        box,
        "transition-colors hover:border-blue-300 hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
      )}
    >
      {content}
    </Link>
  ) : (
    <div className={box}>{content}</div>
  );
}

/** A responsive grid of stat cards. */
export function StatGrid({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className={cn("grid gap-3", className)}>
      {children}
    </section>
  );
}
