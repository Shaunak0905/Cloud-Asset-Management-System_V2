import Link from "next/link";

import { auditActionLabel } from "@/lib/audit/events";
import {
  auditReference,
  type AuditRow,
  type NameLookup,
} from "@/lib/audit/format";
import { formatDateTime } from "@/lib/format";

/**
 * The latest audit events in one line each (docs/12 §16): who, what, which
 * record, when. Admin dashboard only; the full log is one click away.
 */
export function RecentActivity({
  rows,
  names,
}: {
  rows: AuditRow[];
  names: NameLookup;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-600">No activity yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-200" aria-label="Recent activity">
      {rows.map((row) => {
        const reference = auditReference(row, names);
        return (
          <li key={row.id} className="py-2.5 text-sm first:pt-0 last:pb-0">
            <p>
              <span className="font-medium text-slate-900">
                {row.actor?.full_name ?? "System"}
              </span>
              <span className="text-slate-600">
                {" · "}
                {auditActionLabel(row.action)}
                {" · "}
              </span>
              {reference.href ? (
                <Link
                  href={reference.href}
                  className="font-mono text-blue-700 hover:underline"
                >
                  {reference.label}
                </Link>
              ) : (
                <span className="text-slate-700">{reference.label}</span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              <time dateTime={row.created_at}>
                {formatDateTime(row.created_at)}
              </time>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
