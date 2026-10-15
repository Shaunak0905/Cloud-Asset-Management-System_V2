import { ListChecks, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DashboardHero, HeroLink } from "@/components/dashboard/dashboard-hero";
import { EmptyPanel } from "@/components/dashboard/empty-panel";
import { StatCard, StatGrid } from "@/components/dashboard/stat-card";
import { MaintenanceTable } from "@/components/maintenance/maintenance-table";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/current-user";
import { getTechnicianDashboard } from "@/lib/dashboard/queries";
import { listMaintenanceRequests } from "@/lib/maintenance/queries";
import { parseMaintenanceListParams } from "@/lib/maintenance/schema";

export const metadata: Metadata = { title: "Technician" };

/** How many of the most urgent requests the dashboard shows. */
const QUEUE_PREVIEW = 5;

const QUEUE = "/technician/maintenance";

/**
 * The technician's dashboard (docs/12 §19–22, §55): their numbers, counted
 * in the database from their own assigned requests, and the top of their
 * priority queue.
 */
export default async function TechnicianDashboardPage() {
  const user = await requireRole(["TECHNICIAN"]);

  const [stats, queue] = await Promise.all([
    getTechnicianDashboard(),
    // The first page of the open-work queue, already most urgent first.
    listMaintenanceRequests(parseMaintenanceListParams({}), {
      assignedTo: user.id,
    }),
  ]);
  const openCount = queue.total ?? 0;

  return (
    <>
      <DashboardHero
        workspace="Technician Workspace"
        title={`Welcome back, ${user.fullName}`}
        description="Your assigned repairs, most urgent first: start work, log what you find and resolve requests."
        actions={
          <HeroLink href={QUEUE} icon={ListChecks}>
            Open My Queue
          </HeroLink>
        }
      />

      <StatGrid label="Your work" className="mb-8 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Assigned, not started"
          value={stats.assigned}
          href={`${QUEUE}?status=ASSIGNED`}
        />
        <StatCard
          label="In progress"
          value={stats.in_progress}
          href={`${QUEUE}?status=IN_PROGRESS`}
        />
        <StatCard
          label="High or critical"
          value={stats.serious}
          hint="Among your open work"
          tone="danger"
        />
        <StatCard
          label="Resolved this month"
          value={stats.resolved_this_month}
          href={`${QUEUE}?status=RESOLVED`}
        />
      </StatGrid>

      <Card
        title="Your queue"
        description={
          openCount === 0
            ? "Requests assigned to you, most urgent first."
            : `${openCount} open ${openCount === 1 ? "request" : "requests"}, most urgent first.`
        }
        actions={
          openCount > 0 ? (
            <Link
              href={QUEUE}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              View all
            </Link>
          ) : undefined
        }
      >
        {openCount === 0 ? (
          <EmptyPanel
            icon={Wrench}
            tone="green"
            title="No open work"
            description="Maintenance requests assigned to you will appear here, highest priority first."
            link={{
              href: `${QUEUE}?status=RESOLVED`,
              label: "See requests you resolved",
            }}
          />
        ) : (
          <MaintenanceTable
            rows={queue.rows.slice(0, QUEUE_PREVIEW)}
            caption="Most urgent maintenance requests assigned to me"
            showLocation
          />
        )}
      </Card>
    </>
  );
}
