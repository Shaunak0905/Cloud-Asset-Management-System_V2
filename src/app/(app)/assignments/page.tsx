import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ReturnAssetButton } from "@/components/assignments/return-asset-button";
import { AssignmentStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { returnAsset } from "@/lib/assignments/actions";
import {
  ASSIGNMENTS_PAGE_SIZE,
  listMyAssignments,
} from "@/lib/assignments/queries";
import { isOverdue } from "@/lib/assignments/status";
import { requireUser } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/format";
import { locationLabel } from "@/lib/locations/types";

export const metadata: Metadata = { title: "My Assignments" };

export default async function MyAssignmentsPage({
  searchParams,
}: PageProps<"/assignments">) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const parsedPage = Number.parseInt(String(pageParam ?? "1"), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { rows, total } = await listMyAssignments(user.id, page);
  const now = new Date();

  return (
    <>
      <PageHeader
        title="My Assignments"
        description="Assets you are using, and the ones you have used before."
        actions={
          <Link
            href="/assets"
            className={buttonClasses({ variant: "secondary" })}
          >
            Browse assets
          </Link>
        }
      />

      {total === null || rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="You have no asset assignments"
          description="Scan an asset's QR code or browse the asset list to request one."
          action={
            <Link href="/assets" className={buttonClasses()}>
              Browse assets
            </Link>
          }
        />
      ) : (
        <>
          <Table caption="My assignments">
            <TableHead>
              <tr>
                <TableHeaderCell>Asset</TableHeaderCell>
                <TableHeaderCell>Used at</TableHeaderCell>
                <TableHeaderCell>Assigned</TableHeaderCell>
                <TableHeaderCell>Expected return</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    {assignment.assets && (
                      <Link
                        href={`/assets/${assignment.assets.asset_id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {assignment.assets.name}
                      </Link>
                    )}
                    <p className="font-mono text-xs text-slate-500">
                      {assignment.assets?.asset_id}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {locationLabel(assignment.buildings, assignment.rooms)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(assignment.assigned_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(assignment.expected_return_at)}
                    {isOverdue(
                      assignment.status,
                      assignment.expected_return_at,
                      now,
                    ) && (
                      <Badge tone="red" className="ml-2">
                        Overdue
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <AssignmentStatusBadge status={assignment.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {assignment.status === "ACTIVE" && assignment.assets && (
                      <ReturnAssetButton
                        action={returnAsset.bind(
                          null,
                          assignment.id,
                          assignment.assets.asset_id,
                        )}
                        assetName={assignment.assets.name}
                        size="sm"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={ASSIGNMENTS_PAGE_SIZE}
            total={total}
            hrefFor={(target) =>
              target > 1 ? `/assignments?page=${target}` : "/assignments"
            }
            label="assignments"
          />
        </>
      )}
    </>
  );
}
