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
  const isAlert = value > 0 && tone !== "neutral";
  const content = (
    <>
      <span className="block text-xs font-semibold tracking-wider text-slate-500 uppercase">
        {label}
      </span>
      <span
        className={cn(
          "mt-2 block text-3xl font-extrabold tracking-tight tabular-nums",
          VALUE_TONES[value > 0 ? tone : "neutral"],
        )}
      >
        {display ?? value}
      </span>
      {hint && (
        <span className="mt-1.5 line-clamp-2 block text-xs text-slate-500">
          {hint}
        </span>
      )}
    </>
  );

  const box = cn(
    "group relative block overflow-hidden rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200",
    isAlert && tone === "danger" && "border-red-200/90 bg-red-50/20",
    isAlert && tone === "warning" && "border-amber-200/90 bg-amber-50/20",
  );

  return href ? (
    <Link
      href={href}
      className={cn(
        box,
        "hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-colors",
          isAlert && tone === "danger"
            ? "bg-red-500"
            : isAlert && tone === "warning"
              ? "bg-amber-500"
              : "bg-transparent group-hover:bg-blue-600",
        )}
      />
      {content}
    </Link>
  ) : (
    <div className={box}>
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          isAlert && tone === "danger"
            ? "bg-red-500"
            : isAlert && tone === "warning"
              ? "bg-amber-500"
              : "bg-transparent",
        )}
      />
      {content}
    </div>
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
