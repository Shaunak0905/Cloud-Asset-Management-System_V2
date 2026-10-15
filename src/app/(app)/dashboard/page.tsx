import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ReturnAssetButton } from "@/components/assignments/return-asset-button";
import { ActiveAssignmentsList } from "@/components/dashboard/active-assignments-list";
import { DashboardHero, HeroLink } from "@/components/dashboard/dashboard-hero";
import { EmptyPanel } from "@/components/dashboard/empty-panel";
import { StatCard, StatGrid } from "@/components/dashboard/stat-card";
import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { returnAsset } from "@/lib/assignments/actions";
import { listActiveAssignments } from "@/lib/assignments/queries";
import { requireUser } from "@/lib/auth/current-user";
import { homePathForRole } from "@/lib/auth/routes";
import { getMyDashboard } from "@/lib/dashboard/queries";
import { listMyReports } from "@/lib/maintenance/queries";

export const metadata: Metadata = { title: "Dashboard" };

const PREVIEW = 5;

function viewAll(href: string) {
  return (
    <Link
      href={href}
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      View all
    </Link>
  );
}

/**
 * The student/staff dashboard (docs/12 §24–27, §56): the assets they are
 * using (with where they are using them), overdue returns, and their
 * problem reports. Everything is scoped to the signed-in user.
 */
export default async function DashboardPage() {
  const user = await requireUser();

  // Admins and technicians have their own dashboards.
  const home = homePathForRole(user.role);
  if (home !== "/dashboard") {
    redirect(home);
  }

  const [stats, assets, reports] = await Promise.all([
    getMyDashboard(),
    listActiveAssignments({ userId: user.id, limit: PREVIEW }),
    listMyReports(user.id, 1),
  ]);
  const now = new Date();

  return (
    <>
      <DashboardHero
        workspace="Campus Member Workspace"
        title={`Welcome back, ${user.fullName}`}
        description="Track your borrowed campus equipment, monitor return schedules, and submit maintenance tickets."
        actions={
          <HeroLink href="/assets" icon={Package}>
            Browse Catalog
          </HeroLink>
        }
      />

      <StatGrid label="Summary" className="mb-8 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Assets you are using"
          value={stats.active_assignments}
          href="/assignments"
        />
        <StatCard
          label="Overdue returns"
          value={stats.overdue_assignments}
          href="/assignments"
          tone="danger"
          hint={
            stats.overdue_assignments > 0
              ? "Please return these, or ask an admin for more time."
              : undefined
          }
        />
        <StatCard
          label="Open problem reports"
          value={stats.open_reports}
          href="/maintenance"
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Assets you are using"
          description="Hardware currently in your custody and usage location."
          actions={
            stats.active_assignments > PREVIEW
              ? viewAll("/assignments")
              : undefined
          }
        >
          {assets.length === 0 ? (
            <EmptyPanel
              icon={Package}
              title="No active asset checkouts"
              description="Scan an asset's physical QR sticker with your phone or browse available devices to request one."
              link={{ href: "/assets", label: "Browse equipment catalog" }}
            />
          ) : (
            <ActiveAssignmentsList
              items={assets}
              now={now}
              actions={(item) =>
                item.assets && (
                  <ReturnAssetButton
                    action={returnAsset.bind(
                      null,
                      item.id,
                      item.assets.asset_id,
                    )}
                    assetName={item.assets.name}
                    size="sm"
                  />
                )
              }
            />
          )}
        </Card>

        <Card
          title="Your recent reports"
          description="Maintenance requests and repair statuses you have submitted."
          actions={
            (reports.total ?? 0) > PREVIEW ? viewAll("/maintenance") : undefined
          }
        >
          {reports.rows.length === 0 ? (
            <EmptyPanel
              icon={Package}
              tone="amber"
              title="No maintenance tickets filed"
              description="Found a defective projector or lab equipment? Scan its QR code and click “Report a problem”."
              link={{ href: "/maintenance", label: "View maintenance logs" }}
            />
          ) : (
            <MaintenanceTable
              rows={reports.rows.slice(0, PREVIEW)}
              caption="My recent maintenance requests"
            />
          )}
        </Card>
      </div>
    </>
  );
}
