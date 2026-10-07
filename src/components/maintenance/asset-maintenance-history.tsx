import Link from "next/link";

import {
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/status-badges";
import { formatCampusDate } from "@/lib/format";
import type { Enums } from "@/types/database";

export type AssetMaintenanceItem = {
  id: string;
  request_number: string;
  status: Enums<"maintenance_status">;
  priority: Enums<"maintenance_priority">;
  description: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  cancelled_at: string | null;
};

/**
 * An asset's repair history (docs/08 §33): each problem, its outcome and
 * what was done, newest first, linking to the request.
 */
export function AssetMaintenanceHistory({
  items,
}: {
  items: AssetMaintenanceItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No problems have been reported for this asset.
      </p>
    );
  }

  return (
    <ol className="divide-y divide-slate-200" aria-label="Maintenance history">
      {items.map((item) => {
        const closedAt = item.resolved_at ?? item.cancelled_at;
        return (
          <li key={item.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/maintenance/${item.request_number}`}
                className="font-mono text-sm font-medium text-blue-700 hover:underline"
              >
                {item.request_number}
              </Link>
              <MaintenanceStatusBadge status={item.status} />
              <PriorityBadge priority={item.priority} />
              <span className="text-xs text-slate-500">
                Reported {formatCampusDate(item.created_at)}
                {closedAt && <> · closed {formatCampusDate(closedAt)}</>}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-700">
              {item.description}
            </p>
            {item.status === "RESOLVED" && item.resolution_notes && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                <span className="font-medium text-green-800">Done: </span>
                {item.resolution_notes}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
