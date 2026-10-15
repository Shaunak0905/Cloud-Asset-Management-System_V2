import { CircleCheck, Plus, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActiveAssignmentsList } from "@/components/dashboard/active-assignments-list";
import { DashboardHero, HeroLink } from "@/components/dashboard/dashboard-hero";
import { DistributionList } from "@/components/dashboard/distribution-list";
import { EmptyPanel } from "@/components/dashboard/empty-panel";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import {
  CardSkeleton,
  StatGridSkeleton,
} from "@/components/dashboard/skeletons";
import { StatCard, StatGrid } from "@/components/dashboard/stat-card";
import { SustainabilitySummary } from "@/components/dashboard/sustainability-summary";
import { TechnicianWorkload } from "@/components/dashboard/technician-workload";
import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listActiveAssignments } from "@/lib/assignments/queries";
import { listRecentActivity } from "@/lib/audit/queries";
import { requireRole } from "@/lib/auth/current-user";
import { getAdminDashboard, getSustainability } from "@/lib/dashboard/queries";
import { listMaintenanceRequests } from "@/lib/maintenance/queries";
import { parseMaintenanceListParams } from "@/lib/maintenance/schema";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Admin" };

const RECENT_COUNT = 5;

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function assetsHref(status: Enums<"asset_status">): string {
  return `/admin/assets?status=${status}`;
}

function viewAll(href: string, label: string) {
  return (
    <Link
      href={href}
      className={buttonClasses({ variant: "secondary", size: "sm" })}
    >
      {label}
    </Link>
  );
}

/** Asset and maintenance numbers, attention list, workload and inventory. */
async function Overview() {
  const [dashboard, overdue] = await Promise.all([
    getAdminDashboard(),
    listActiveAssignments({ overdueOnly: true, limit: RECENT_COUNT }),
  ]);
  const assets = dashboard.assets_by_status;
  const maintenance = dashboard.maintenance_by_status;
  const critical = dashboard.open_by_priority.CRITICAL;

  const attention = [
    critical > 0 && {
      key: "critical",
      text: `${plural(critical, "critical request")} not yet resolved`,
      href: "/admin/maintenance?priority=CRITICAL",
    },
    dashboard.unassigned_serious > 0 && {
      key: "unassigned",
      text: `${plural(dashboard.unassigned_serious, "high-priority or critical request")} waiting for a technician`,
      href: "/admin/maintenance?status=OPEN",
    },
    dashboard.overdue_assignments > 0 && {
      key: "overdue",
      text: `${plural(dashboard.overdue_assignments, "asset")} overdue for return`,
      href: null,
    },
  ].filter((item) => item !== false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Assets</h2>
        <StatGrid label="Assets" className="grid-cols-2 sm:grid-cols-4">
          <StatCard
            label="Total assets"
            value={dashboard.total_assets}
            href="/admin/assets"
          />
          <StatCard
            label="Available"
            value={assets.AVAILABLE}
            href={assetsHref("AVAILABLE")}
          />
          <StatCard
            label="Assigned"
            value={assets.ASSIGNED}
            href={assetsHref("ASSIGNED")}
            hint={`${plural(dashboard.overdue_assignments, "overdue return")}`}
          />
          <StatCard
            label="In maintenance"
            value={assets.IN_MAINTENANCE}
            href={assetsHref("IN_MAINTENANCE")}
            tone="warning"
          />
          <StatCard
            label="Damaged"
            value={assets.DAMAGED}
            href={assetsHref("DAMAGED")}
            tone="danger"
          />
          <StatCard
            label="Lost"
            value={assets.LOST}
            href={assetsHref("LOST")}
            tone="danger"
          />
          <StatCard
            label="Retired"
            value={assets.RETIRED}
            href={assetsHref("RETIRED")}
          />
          <StatCard
            label="Overdue returns"
            value={dashboard.overdue_assignments}
            tone="danger"
          />
        </StatGrid>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Maintenance
        </h2>
        <StatGrid
          label="Maintenance"
          className="grid-cols-2 sm:grid-cols-3 xl:grid-cols-5"
        >
          <StatCard
            label="Waiting for a technician"
            value={maintenance.OPEN}
            href="/admin/maintenance?status=OPEN"
            tone="warning"
          />
          <StatCard
            label="Assigned"
            value={maintenance.ASSIGNED}
            href="/admin/maintenance?status=ASSIGNED"
          />
          <StatCard
            label="In progress"
            value={maintenance.IN_PROGRESS}
            href="/admin/maintenance?status=IN_PROGRESS"
          />
          <StatCard
            label="Critical, not resolved"
            value={critical}
            href="/admin/maintenance?priority=CRITICAL"
            tone="danger"
          />
          <StatCard
            label="Resolved this month"
            value={dashboard.resolved_this_month}
            href="/admin/maintenance?status=RESOLVED"
          />
        </StatGrid>
      </div>

      <Suspense
        fallback={
          <StatGridSkeleton
            count={4}
            label="sustainability figures"
            className="grid-cols-2 sm:grid-cols-4"
          />
        }
      >
        <Sustainability />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Attention required">
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <CircleCheck aria-hidden className="size-4 text-green-700" />
              Nothing needs attention right now.
            </p>
          ) : (
            <ul className="space-y-4">
              {attention.map((item) => (
                <li key={item.key}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      {item.text}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">
                      {item.text}
                    </p>
                  )}
                  {item.key === "overdue" && overdue.length > 0 && (
                    <div className="mt-2">
                      <ActiveAssignmentsList items={overdue} showHolder />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Technician workload"
          description="Current work and this month's resolved requests."
        >
          <TechnicianWorkload rows={dashboard.technicians} />
        </Card>

        <Card title="Assets by category" description="Excludes retired assets.">
          <DistributionList
            label="Assets by category"
            emptyText="No assets yet."
            items={dashboard.assets_by_category.map((item) => ({
              ...item,
              href: `/admin/assets?category=${encodeURIComponent(item.key)}`,
            }))}
          />
        </Card>

        <Card
          title="Assets by building"
          description="Where assets belong (home location). Excludes retired assets."
        >
          <DistributionList
            label="Assets by building"
            emptyText="No assets yet."
            items={dashboard.assets_by_building.map((item) => ({
              ...item,
              href: `/admin/assets?building=${item.key}`,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

/** Repair, sharing and warranty figures (SDG 12); streams in separately. */
async function Sustainability() {
  return <SustainabilitySummary data={await getSustainability()} />;
}

async function RecentMaintenance() {
  const { rows } = await listMaintenanceRequests(
    parseMaintenanceListParams({}),
  );
  return (
    <Card
      title="Recent maintenance"
      actions={viewAll("/admin/maintenance", "View all")}
    >
      {rows.length === 0 ? (
        <EmptyPanel
          icon={Wrench}
          tone="green"
          title="No problems reported yet"
          description="Problems people report from an asset's page or QR code will appear here."
        />
      ) : (
        <MaintenanceTable
          rows={rows.slice(0, RECENT_COUNT)}
          caption="Most recent maintenance requests"
          showTechnician
        />
      )}
    </Card>
  );
}

async function LatestActivity() {
  const { rows, names } = await listRecentActivity(RECENT_COUNT);
  return (
    <Card
      title="Recent activity"
      actions={viewAll("/admin/audit-logs", "View audit log")}
    >
      <RecentActivity rows={rows} names={names} />
    </Card>
  );
}

/**
 * The admin overview (docs/12 §3–17, §54). Numbers come from one database
 * function that counts with GROUP BY; each section streams in on its own,
 * so one slow query does not hold up the rest (docs/12 §33).
 */
export default async function AdminDashboardPage() {
  const user = await requireRole(["ADMIN"]);

  return (
    <>
      <DashboardHero
        workspace="Administrator Console"
        title={`Welcome back, ${user.fullName}`}
        description="Campus assets, maintenance and people at a glance: what needs attention, who is working on what, and where everything is."
        actions={
          <>
            <HeroLink href="/admin/assets/new" icon={Plus}>
              Add Asset
            </HeroLink>
            <HeroLink href="/admin/maintenance" icon={Wrench}>
              Maintenance
            </HeroLink>
          </>
        }
      />
      <Suspense
        fallback={
          <StatGridSkeleton
            count={8}
            label="dashboard"
            className="grid-cols-2 sm:grid-cols-4"
          />
        }
      >
        <Overview />
      </Suspense>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Suspense fallback={<CardSkeleton title="Recent maintenance" />}>
          <RecentMaintenance />
        </Suspense>
        <Suspense fallback={<CardSkeleton title="Recent activity" />}>
          <LatestActivity />
        </Suspense>
      </div>
    </>
  );
}
