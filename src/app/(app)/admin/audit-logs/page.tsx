import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditLogTable } from "@/components/audit/audit-log-table";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { listAuditLogs } from "@/lib/audit/queries";
import {
  AUDIT_PAGE_SIZE,
  auditListQuery,
  hasAuditFilters,
  parseAuditListParams,
} from "@/lib/audit/schema";
import { requireRole } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Audit Logs" };

const BASE_PATH = "/admin/audit-logs";

/**
 * Admin-only audit log viewer (docs/13 §37–41, §53). The page guard sends
 * everyone else to the access-denied page, and RLS returns no audit rows to
 * non-admins even if they query the API directly.
 */
export default async function AdminAuditLogsPage({
  searchParams,
}: PageProps<"/admin/audit-logs">) {
  await requireRole(["ADMIN"]);

  const params = parseAuditListParams(await searchParams);
  const { rows, total, names } = await listAuditLogs(params);
  const hrefFor = (page: number) =>
    `${BASE_PATH}${auditListQuery({ ...params, page })}`;
  const filtered = hasAuditFilters(params);

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Who did what, and when. Newest first; records cannot be changed or deleted."
      />
      <AuditFilters basePath={BASE_PATH} params={params} />

      {total === null ? (
        <EmptyState
          title="This page is empty"
          description="The list is shorter than the page you asked for."
          action={
            <Link
              href={hrefFor(1)}
              className={buttonClasses({ variant: "secondary" })}
            >
              Go to the first page
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "No events match your filters" : "No events yet"}
          description={
            filtered
              ? "Try a wider date range or fewer filters."
              : "Important actions (assets, assignments, maintenance, files and accounts) will appear here."
          }
          action={
            filtered ? (
              <Link
                href={BASE_PATH}
                className={buttonClasses({ variant: "secondary" })}
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <AuditLogTable rows={rows} names={names} />
          <Pagination
            page={params.page}
            pageSize={AUDIT_PAGE_SIZE}
            total={total}
            hrefFor={hrefFor}
            label="events"
          />
        </>
      )}
    </>
  );
}
