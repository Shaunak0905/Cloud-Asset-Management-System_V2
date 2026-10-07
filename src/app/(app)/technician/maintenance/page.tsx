import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MaintenanceFilters } from "@/components/maintenance/maintenance-filters";
import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireRole } from "@/lib/auth/current-user";
import { listMaintenanceRequests } from "@/lib/maintenance/queries";
import {
  hasMaintenanceFilters,
  MAINTENANCE_PAGE_SIZE,
  maintenanceListQuery,
  type MaintenanceStatus,
  parseMaintenanceListParams,
} from "@/lib/maintenance/schema";

export const metadata: Metadata = { title: "My Maintenance" };

const BASE_PATH = "/technician/maintenance";

/** A technician's requests are never OPEN: that means "no technician yet". */
const TECHNICIAN_STATUSES: readonly MaintenanceStatus[] = [
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CANCELLED",
];

/**
 * Requests assigned to the signed-in technician (docs/08 §14). By default
 * the open work, most urgent first; the status filter reaches closed ones.
 */
export default async function TechnicianMaintenancePage({
  searchParams,
}: PageProps<"/technician/maintenance">) {
  const user = await requireRole(["TECHNICIAN"]);

  const params = parseMaintenanceListParams(await searchParams);
  const { rows, total } = await listMaintenanceRequests(params, {
    assignedTo: user.id,
  });
  const hrefFor = (page: number) =>
    `${BASE_PATH}${maintenanceListQuery({ ...params, page })}`;
  const filtered = hasMaintenanceFilters(params);

  return (
    <>
      <PageHeader
        title="My Maintenance"
        description="Requests assigned to you. Open work is listed most urgent first."
      />
      <MaintenanceFilters
        basePath={BASE_PATH}
        params={params}
        statuses={TECHNICIAN_STATUSES}
        allStatusesLabel="Open work"
        defaultSortLabel="Default order"
      />

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
          icon={Wrench}
          title={filtered ? "No requests match your filters" : "No open work"}
          description={
            filtered
              ? "Try a different search or clear the filters."
              : "When an admin assigns a maintenance request to you, it appears here."
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
          <MaintenanceTable
            rows={rows}
            caption="Maintenance requests assigned to me"
            showLocation
          />
          <Pagination
            page={params.page}
            pageSize={MAINTENANCE_PAGE_SIZE}
            total={total}
            hrefFor={hrefFor}
            label="requests"
          />
        </>
      )}
    </>
  );
}
