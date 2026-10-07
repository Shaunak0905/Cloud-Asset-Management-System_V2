import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { auditActionLabel } from "@/lib/audit/events";
import {
  auditChanges,
  auditDetails,
  auditReference,
  type AuditRow,
  type NameLookup,
} from "@/lib/audit/format";
import { formatDateTime } from "@/lib/format";

function actionTone(action: string) {
  if (action.endsWith("_DELETED") || action === "ASSET_RETIRED") return "red";
  if (action.startsWith("MAINTENANCE_")) return "amber";
  if (action === "ROLE_CHANGED" || action.startsWith("ACCOUNT_")) {
    return "purple";
  }
  return "blue";
}

/**
 * Audit events, newest first (docs/13 §37–38): when, who, what, which
 * record, and what changed. Further details expand in place. Nothing here
 * can be edited — the audit log is append-only.
 */
export function AuditLogTable({
  rows,
  names,
}: {
  rows: AuditRow[];
  names: NameLookup;
}) {
  return (
    <Table caption="Audit log">
      <TableHead>
        <tr>
          <TableHeaderCell>When</TableHeaderCell>
          <TableHeaderCell>Done by</TableHeaderCell>
          <TableHeaderCell>Action</TableHeaderCell>
          <TableHeaderCell>Record</TableHeaderCell>
          <TableHeaderCell>Changes</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const reference = auditReference(row, names);
          const changes = auditChanges(row, names);
          const details = auditDetails(row, names);
          return (
            <TableRow key={row.id} className="align-top">
              <TableCell className="whitespace-nowrap text-slate-600">
                <time dateTime={row.created_at}>
                  {formatDateTime(row.created_at)}
                </time>
              </TableCell>
              <TableCell>
                {row.actor ? (
                  <>
                    <p className="font-medium text-slate-900">
                      {row.actor.full_name}
                    </p>
                    {row.actor.email && (
                      <p className="text-xs text-slate-500">
                        {row.actor.email}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-slate-500">System</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge tone={actionTone(row.action)}>
                  {auditActionLabel(row.action)}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
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
              </TableCell>
              <TableCell className="min-w-56">
                {changes.length > 0 && (
                  <ul className="space-y-0.5">
                    {changes.map((change) => (
                      <li key={change.field}>
                        <span className="text-slate-500">{change.field}: </span>
                        {change.from !== null && (
                          <>
                            <span className="text-slate-600">
                              {change.from}
                            </span>
                            {" → "}
                          </>
                        )}
                        <span className="font-medium text-slate-900">
                          {change.to}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {details.length > 0 && (
                  <details className="mt-1 text-slate-600">
                    <summary className="cursor-pointer text-xs text-blue-700 hover:underline">
                      Details
                    </summary>
                    <dl className="mt-1 space-y-0.5 text-xs">
                      {details.map((detail) => (
                        <div key={detail.label}>
                          <dt className="inline text-slate-500">
                            {detail.label}:{" "}
                          </dt>
                          <dd className="inline text-slate-800">
                            {detail.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
                {changes.length === 0 && details.length === 0 && (
                  <span className="text-slate-400">—</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
