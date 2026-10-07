import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/** Inline spinner with an accessible label. */
export function Spinner({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-sm text-slate-600"
    >
      <LoaderCircle
        aria-hidden
        className={cn("size-4 animate-spin", className)}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Placeholder block shown while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-slate-200", className)}
    />
  );
}
