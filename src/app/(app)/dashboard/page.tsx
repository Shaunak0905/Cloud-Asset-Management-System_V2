import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ReturnAssetButton } from "@/components/assignments/return-asset-button";
import { ActiveAssignmentsList } from "@/components/dashboard/active-assignments-list";
import { StatCard, StatGrid } from "@/components/dashboard/stat-card";
import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
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
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-6 text-white shadow-sm sm:p-8">
        <div
          aria-hidden="true"
          className="pattern-dots pointer-events-none absolute inset-0 opacity-15"
        />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur-xs">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>Campus Member Workspace</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, {user.fullName}
            </h1>
            <p className="mt-1 text-sm text-blue-100/90 sm:text-base">
              Track your borrowed campus equipment, monitor return schedules, and submit maintenance tickets.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Link
              href="/assets"
              className={buttonClasses({
                variant: "secondary",
                className:
                  "border-0 bg-white text-blue-900 shadow-sm hover:bg-blue-50",
              })}
            >
              <Package aria-hidden className="size-4 text-blue-700" />
              <span>Browse Catalog</span>
            </Link>
          </div>
        </div>
      </div>

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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Package aria-hidden className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                No active asset checkouts
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Scan an asset&apos;s physical QR sticker with your phone or browse available devices to request one.
              </p>
              <Link
                href="/assets"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <span>Browse equipment catalog</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Package aria-hidden className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                No maintenance tickets filed
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Found a defective projector or lab equipment? Scan its QR code and click &ldquo;Report a problem&rdquo;.
              </p>
              <Link
                href="/maintenance"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                <span>View maintenance logs</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
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
