import { Check } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils/cn";
import type { Enums } from "@/types/database";

type MaintenanceStatus = Enums<"maintenance_status">;

type Step = { label: string; at: string | null; done: boolean };

/**
 * Where a request is in its lifecycle (docs/08 §11): Reported → Technician
 * assigned → In progress → Resolved, or ending in Cancelled. Times come from
 * the request itself; the start time comes from its history, which only
 * admins and the assigned technician can read, so reporters see the step
 * without it.
 */
export function requestSteps(request: {
  status: MaintenanceStatus;
  created_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  cancelled_at: string | null;
  startedAt?: string | null;
}): Step[] {
  const reached: Record<MaintenanceStatus, number> = {
    OPEN: 1,
    ASSIGNED: 2,
    IN_PROGRESS: 3,
    RESOLVED: 4,
    CANCELLED: 0,
  };
  const reported = { label: "Reported", at: request.created_at, done: true };

  if (request.status === "CANCELLED") {
    return [
      reported,
      ...(request.assigned_at
        ? [
            {
              label: "Technician assigned",
              at: request.assigned_at,
              done: true,
            },
          ]
        : []),
      { label: "Cancelled", at: request.cancelled_at, done: true },
    ];
  }

  const progress = reached[request.status];
  return [
    reported,
    {
      label: "Technician assigned",
      at: request.assigned_at,
      done: progress >= 2,
    },
    {
      label: "In progress",
      at: request.startedAt ?? null,
      done: progress >= 3,
    },
    { label: "Resolved", at: request.resolved_at, done: progress >= 4 },
  ];
}

export function RequestProgress({ steps }: { steps: Step[] }) {
  return (
    <ol
      aria-label="Progress"
      className="grid grid-cols-1 gap-3 sm:auto-cols-fr sm:grid-flow-col"
    >
      {steps.map((step) => (
        <li key={step.label} className="flex items-start gap-2">
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
              step.done
                ? "border-green-700 bg-green-700 text-white"
                : "border-slate-300 bg-white",
            )}
          >
            {step.done && <Check className="size-3.5" />}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm",
                step.done ? "font-medium text-slate-900" : "text-slate-500",
              )}
            >
              {step.label}
              <span className="sr-only">
                {step.done ? " (done)" : " (not yet)"}
              </span>
            </span>
            {step.done && step.at && (
              <time dateTime={step.at} className="block text-xs text-slate-500">
                {formatDateTime(step.at)}
              </time>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
