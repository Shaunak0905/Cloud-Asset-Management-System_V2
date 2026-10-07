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
import {
  listActiveTechnicians,
  listMaintenanceRequests,
} from "@/lib/maintenance/queries";
import {
  hasMaintenanceFilters,
  MAINTENANCE_PAGE_SIZE,
  maintenanceListQuery,
  parseMaintenanceListParams,
} from "@/lib/maintenance/schema";

export const metadata: Metadata = { title: "Maintenance" };

const BASE_PATH = "/admin/maintenance";

export default async function AdminMaintenancePage({
  searchParams,
}: PageProps<"/admin/maintenance">) {
  await requireRole(["ADMIN"]);

  const params = parseMaintenanceListParams(await searchParams);
  const [{ rows, total }, technicians] = await Promise.all([
    listMaintenanceRequests(params),
    listActiveTechnicians(),
  ]);
  const hrefFor = (page: number) =>
    `${BASE_PATH}${maintenanceListQuery({ ...params, page })}`;
  const filtered = hasMaintenanceFilters(params);

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Every problem report, newest first."
      />
      <MaintenanceFilters
        basePath={BASE_PATH}
        params={params}
        technicians={technicians}
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
          title={
            filtered
              ? "No requests match your filters"
              : "No problems reported yet"
          }
          description={
            filtered
              ? "Try a different search or clear the filters."
              : "Reports made from asset pages and QR codes will appear here."
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
            caption="Maintenance requests"
            showTechnician
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
