import { MapPin } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { isOverdue } from "@/lib/assignments/status";
import { formatDateTime } from "@/lib/format";
import { locationLabel } from "@/lib/locations/types";

export type ActiveAssignmentItem = {
  id: string;
  expected_return_at: string | null;
  assets: { asset_id: string; name: string } | null;
  buildings: { name: string } | null;
  rooms: { room_number: string } | null;
  profiles: { full_name: string; email: string | null } | null;
};

/**
 * Assets in use, with where they are being used — the assignment's usage
 * location, not the asset's home (docs/12 §26) — and when they are due back.
 * `showHolder` adds who has each asset (admins); `actions` renders per-item
 * buttons such as Return.
 */
export function ActiveAssignmentsList({
  items,
  showHolder = false,
  actions,
  now = new Date(),
}: {
  items: ActiveAssignmentItem[];
  showHolder?: boolean;
  actions?: (item: ActiveAssignmentItem) => ReactNode;
  now?: Date;
}) {
  return (
    <ul className="divide-y divide-slate-200" aria-label="Assets in use">
      {items.map((item) => {
        const overdue = isOverdue("ACTIVE", item.expected_return_at, now);
        return (
          <li
            key={item.id}
            className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              {item.assets && (
                <Link
                  href={`/assets/${item.assets.asset_id}`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  {item.assets.name}
                </Link>
              )}
              {showHolder && item.profiles && (
                <span className="text-sm text-slate-600">
                  {" · "}
                  {item.profiles.full_name}
                </span>
              )}
              <p className="flex items-center gap-1 text-sm text-slate-600">
                <MapPin
                  aria-hidden
                  className="size-3.5 shrink-0 text-slate-400"
                />
                {locationLabel(item.buildings, item.rooms)}
              </p>
              <p className="text-xs text-slate-500">
                {item.expected_return_at ? (
                  <>
                    Return by {formatDateTime(item.expected_return_at)}
                    {overdue && (
                      <Badge tone="red" className="ml-2">
                        Overdue
                      </Badge>
                    )}
                  </>
                ) : (
                  "No return time set"
                )}
              </p>
            </div>
            {actions && <div className="shrink-0">{actions(item)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
