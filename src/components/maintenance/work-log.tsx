import {
  Ban,
  CircleCheck,
  Cog,
  FlaskConical,
  type LucideIcon,
  MessageSquare,
  Play,
  Search,
  Stethoscope,
  TriangleAlert,
  UserCheck,
  Wrench,
} from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { MAINTENANCE_ACTION } from "@/lib/labels";
import { cn } from "@/lib/utils/cn";
import type { Enums } from "@/types/database";

type MaintenanceAction = Enums<"maintenance_action">;

export type WorkLogEntry = {
  id: string;
  action: MaintenanceAction;
  notes: string | null;
  performed_at: string;
  performed_by: string;
  performer: { full_name: string } | null;
};

/** Icon and colour per entry; workflow steps stand out from work notes. */
const STEP_STYLE: Record<
  MaintenanceAction,
  { icon: LucideIcon; className: string }
> = {
  REPORTED: { icon: TriangleAlert, className: "bg-amber-100 text-amber-800" },
  ASSIGNED: { icon: UserCheck, className: "bg-purple-100 text-purple-800" },
  STARTED: { icon: Play, className: "bg-blue-100 text-blue-800" },
  INSPECTION: { icon: Search, className: "bg-slate-100 text-slate-700" },
  DIAGNOSIS: { icon: Stethoscope, className: "bg-slate-100 text-slate-700" },
  REPAIR: { icon: Wrench, className: "bg-slate-100 text-slate-700" },
  PART_REPLACEMENT: { icon: Cog, className: "bg-slate-100 text-slate-700" },
  TESTING: { icon: FlaskConical, className: "bg-slate-100 text-slate-700" },
  NOTE: { icon: MessageSquare, className: "bg-slate-100 text-slate-700" },
  RESOLVED: { icon: CircleCheck, className: "bg-green-100 text-green-800" },
  CANCELLED: { icon: Ban, className: "bg-slate-200 text-slate-700" },
};

/**
 * A request's maintenance timeline, oldest first (docs/08 §20, docs/16
 * Phase 15): every entry is a maintenance_history row — workflow steps
 * (reported, assigned, started, resolved/cancelled) and technician notes
 * (inspection, diagnosis, repair, parts, testing). Nothing is made up. The
 * author is shown when the viewer may see their profile.
 */
export function WorkLog({
  entries,
  viewerId,
}: {
  entries: WorkLogEntry[];
  viewerId: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-600">Nothing recorded yet.</p>;
  }

  return (
    <ol aria-label="Work log">
      {entries.map((entry, index) => {
        const author =
          entry.performed_by === viewerId ? "You" : entry.performer?.full_name;
        const { icon: Icon, className } = STEP_STYLE[entry.action];
        const last = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className="absolute top-8 bottom-0 left-3.5 w-px bg-slate-200"
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative flex size-7 shrink-0 items-center justify-center rounded-full",
                className,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm">
                <span className="font-medium text-slate-900">
                  {MAINTENANCE_ACTION[entry.action]}
                </span>
                {author && <span className="text-slate-600"> · {author}</span>}
              </p>
              <p className="text-xs text-slate-500">
                <time dateTime={entry.performed_at}>
                  {formatDateTime(entry.performed_at)}
                </time>
              </p>
              {entry.notes && (
                <p className="mt-1 text-sm whitespace-pre-line text-slate-700">
                  {entry.notes}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
