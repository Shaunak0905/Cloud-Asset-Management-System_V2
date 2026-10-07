import { Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireUser } from "@/lib/auth/current-user";
import { listMyReports } from "@/lib/maintenance/queries";
import { MAINTENANCE_PAGE_SIZE } from "@/lib/maintenance/schema";

export const metadata: Metadata = { title: "My Requests" };

export default async function MyMaintenanceRequestsPage({
  searchParams,
}: PageProps<"/maintenance">) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const parsedPage = Number.parseInt(String(pageParam ?? "1"), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { rows, total } = await listMyReports(user.id, page);

  return (
    <>
      <PageHeader
        title="My Requests"
        description="Problems you have reported and their progress."
      />

      {total === null || rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="You have not reported any problems"
          description="To report one, open the asset (or scan its QR code) and choose Report a problem."
          action={
            <Link href="/assets" className={buttonClasses()}>
              Browse assets
            </Link>
          }
        />
      ) : (
        <>
          <MaintenanceTable rows={rows} caption="My maintenance requests" />
          <Pagination
            page={page}
            pageSize={MAINTENANCE_PAGE_SIZE}
            total={total}
            hrefFor={(target) =>
              target > 1 ? `/maintenance?page=${target}` : "/maintenance"
            }
            label="requests"
          />
        </>
      )}
    </>
  );
}
