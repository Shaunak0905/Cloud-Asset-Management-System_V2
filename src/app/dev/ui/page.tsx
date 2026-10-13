import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuditLogTable } from "@/components/audit/audit-log-table";
import { DistributionList } from "@/components/dashboard/distribution-list";
import { StatCard, StatGrid } from "@/components/dashboard/stat-card";
import { SustainabilitySummary } from "@/components/dashboard/sustainability-summary";
import { TechnicianWorkload } from "@/components/dashboard/technician-workload";
import { AppShell } from "@/components/layout/app-shell";
import { MaintenanceFilters } from "@/components/maintenance/maintenance-filters";
import { parseMaintenanceListParams } from "@/lib/maintenance/schema";
import { AssetMaintenanceHistory } from "@/components/maintenance/asset-maintenance-history";
import {
  RequestProgress,
  requestSteps,
} from "@/components/maintenance/request-progress";
import {
  AssetStatusBadge,
  AssignmentStatusBadge,
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, fieldErrorId } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Skeleton, Spinner } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { CurrentUser, UserRole } from "@/lib/auth/types";
import { Constants } from "@/types/database";

import { AssetQrCode } from "@/components/qr/asset-qr-code";
import { getAppUrl } from "@/lib/env";
import { getAssetPublicUrl } from "@/lib/qr";

import {
  InteractiveDemos,
  LocationSelectorDemo,
  StorageDemo,
  TechnicianWorkflowDemo,
  UsersDemo,
} from "./interactive-demos";

// Development-only visual reference for the app shell and UI components.
// Renders sample data only; returns 404 outside `next dev`.

export const metadata: Metadata = {
  title: "UI gallery",
  robots: { index: false },
};

const ROLES = Constants.public.Enums.user_role;

const DEMO_TECH = "00000000-0000-4000-8000-0000000000aa";

const DEMO_AUDIT = [
  {
    id: "audit-1",
    action: "MAINTENANCE_RESOLVED",
    entity_type: "maintenance_request",
    entity_id: "demo-request",
    old_values: { status: "IN_PROGRESS" },
    new_values: { status: "RESOLVED" },
    metadata: {
      request_number: "MR-2026-0017",
      asset_id: "AST-2026-00001",
      final_asset_status: "AVAILABLE",
      resolved_at: "2026-10-04T08:35:00Z",
    },
    created_at: "2026-10-04T08:35:00Z",
    actor_id: DEMO_TECH,
    actor: { full_name: "Ravi Kumar", email: "ravi@campus.edu" },
  },
  {
    id: "audit-2",
    action: "MAINTENANCE_ASSIGNED",
    entity_type: "maintenance_request",
    entity_id: "demo-request",
    old_values: { status: "OPEN", assigned_to: null },
    new_values: { status: "ASSIGNED", assigned_to: DEMO_TECH },
    metadata: { request_number: "MR-2026-0017", technician_id: DEMO_TECH },
    created_at: "2026-10-04T05:10:00Z",
    actor_id: "demo-admin",
    actor: { full_name: "Asha Admin", email: "asha@campus.edu" },
  },
  {
    id: "audit-3",
    action: "ASSET_REGISTERED_LOCATION_CHANGED",
    entity_type: "asset",
    entity_id: "demo-asset",
    old_values: { building: "VY", room: "VY001" },
    new_values: { building: "VK", room: "VK404" },
    metadata: { asset_id: "AST-2026-00002" },
    created_at: "2026-10-03T11:00:00Z",
    actor_id: "demo-admin",
    actor: { full_name: "Asha Admin", email: "asha@campus.edu" },
  },
  {
    id: "audit-4",
    action: "ROLE_CHANGED",
    entity_type: "profile",
    entity_id: DEMO_TECH,
    old_values: { role: "STUDENT" },
    new_values: { role: "TECHNICIAN" },
    metadata: null,
    created_at: "2026-10-02T09:00:00Z",
    actor_id: "demo-admin",
    actor: { full_name: "Asha Admin", email: "asha@campus.edu" },
  },
];

export default async function UiGalleryPage({
  searchParams,
}: PageProps<"/dev/ui">) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { role } = await searchParams;
  const selectedRole: UserRole = ROLES.find((r) => r === role) ?? "ADMIN";
  const sampleUser: CurrentUser = {
    id: "00000000-0000-0000-0000-000000000000",
    email: "sample.user@campus.edu",
    fullName: "Sample User",
    role: selectedRole,
    department: "Computer Science",
  };

  return (
    <AppShell user={sampleUser} unreadNotifications={3}>
      <PageHeader
        title="UI gallery"
        description="Development-only preview of the shell and components with sample data."
        actions={ROLES.map((r) => (
          <Link
            key={r}
            href={`/dev/ui?role=${r}`}
            aria-current={r === selectedRole ? "true" : undefined}
            className="rounded-md px-2 py-1 text-sm text-blue-700 underline-offset-2 hover:underline aria-[current=true]:bg-blue-50 aria-[current=true]:font-semibold"
          >
            {ROLE_LABELS[r]} nav
          </Link>
        ))}
      />

      <section aria-label="Filters and users sample" className="mb-6 space-y-4">
        <MaintenanceFilters
          basePath="/dev/ui"
          params={parseMaintenanceListParams({ sort: "priority" })}
          technicians={[
            {
              id: "00000000-0000-4000-8000-0000000000a1",
              full_name: "Priya Shah",
            },
            {
              id: "00000000-0000-4000-8000-0000000000a2",
              full_name: "Ravi Kumar",
            },
          ]}
        />
        <UsersDemo />
      </section>

      <section aria-label="Dashboard sample" className="mb-6 space-y-6">
        <StatGrid label="Sample numbers" className="grid-cols-2 sm:grid-cols-4">
          <StatCard label="Total assets" value={142} href="/dev/ui" />
          <StatCard label="Available" value={91} href="/dev/ui" />
          <StatCard
            label="In maintenance"
            value={12}
            href="/dev/ui"
            tone="warning"
          />
          <StatCard
            label="Overdue returns"
            value={3}
            tone="danger"
            hint="Needs follow-up"
          />
        </StatGrid>
        <SustainabilitySummary
          data={{
            repairs: { repaired: 18, still_damaged: 2, retired: 1 },
            sharing: { loans: 64, assets_shared: 17 },
            warranty: { reported_under_warranty: 6, open_under_warranty: 2 },
          }}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card
            title="Assets by building"
            description="Excludes retired assets."
          >
            <DistributionList
              label="Assets by building"
              emptyText="No assets yet."
              items={[
                { key: "vy", label: "Vyas", count: 52, href: "/dev/ui" },
                { key: "vk", label: "Vivekananda", count: 38, href: "/dev/ui" },
                { key: "lib", label: "Library", count: 9 },
              ]}
            />
          </Card>
          <Card title="Technician workload">
            <TechnicianWorkload
              rows={[
                {
                  id: "t1",
                  name: "Priya Shah",
                  assigned: 3,
                  in_progress: 1,
                  resolved_this_month: 8,
                },
                {
                  id: "t2",
                  name: "Ravi Kumar",
                  assigned: 1,
                  in_progress: 2,
                  resolved_this_month: 5,
                },
              ]}
            />
          </Card>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
          </div>
        </Card>

        <Card title="Status badges">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {Constants.public.Enums.asset_status.map((s) => (
                <AssetStatusBadge key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Constants.public.Enums.maintenance_status.map((s) => (
                <MaintenanceStatusBadge key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Constants.public.Enums.maintenance_priority.map((p) => (
                <PriorityBadge key={p} priority={p} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Constants.public.Enums.assignment_status.map((s) => (
                <AssignmentStatusBadge key={s} status={s} />
              ))}
            </div>
          </div>
        </Card>

        <Card
          title="Form controls"
          description="Labels, hints and inline errors."
        >
          <div className="space-y-4">
            <Field id="demo-name" label="Asset name">
              <Input id="demo-name" defaultValue="Epson Projector P-104" />
            </Field>
            <Field
              id="demo-serial"
              label="Serial number"
              error="Serial number is already in use."
            >
              <Input
                id="demo-serial"
                defaultValue="EP-ABC-12345"
                aria-invalid
                aria-describedby={fieldErrorId("demo-serial")}
              />
            </Field>
            <Field id="demo-building" label="Building">
              <Select id="demo-building" defaultValue="">
                <option value="" disabled>
                  Select a building
                </option>
                <option>Vyas</option>
                <option>Vivekananda</option>
              </Select>
            </Field>
            <Field id="demo-description" label="Problem description">
              <Textarea
                id="demo-description"
                placeholder="Describe the problem…"
              />
            </Field>
          </div>
        </Card>

        <Card title="Alerts">
          <div className="space-y-3">
            <Alert tone="error">This asset is currently unavailable.</Alert>
            <Alert tone="warning">Warranty expires in 12 days.</Alert>
            <Alert tone="info">
              Scanning a QR code never changes an asset.
            </Alert>
            <Alert tone="success">Assignment created.</Alert>
          </div>
        </Card>

        <Card title="Dialog & toasts" className="lg:col-span-2">
          <InteractiveDemos />
        </Card>

        <Card
          title="Building → room selector"
          description="Sample data with a simulated delay. “Offline Block” fails to load; “New Block” has no rooms."
          className="lg:col-span-2"
        >
          <LocationSelectorDemo />
        </Card>

        <Card
          title="Technician workflow"
          description="Assign, start work, keep the work log, resolve or cancel. Saves are simulated."
          className="lg:col-span-2"
        >
          <TechnicianWorkflowDemo />
        </Card>

        <Card
          title="Files"
          description="Evidence list and uploader. The browser-side checks run for real; nothing is uploaded."
          className="lg:col-span-2"
        >
          <StorageDemo />
        </Card>

        <Card
          title="Maintenance history"
          description="Request progress (everyone) and an asset's repair history."
          className="lg:col-span-2"
        >
          <div className="space-y-6">
            <RequestProgress
              steps={requestSteps({
                status: "IN_PROGRESS",
                created_at: "2026-10-04T04:10:00Z",
                assigned_at: "2026-10-04T05:10:00Z",
                resolved_at: null,
                cancelled_at: null,
                startedAt: "2026-10-04T06:15:00Z",
              })}
            />
            <AssetMaintenanceHistory
              items={[
                {
                  id: "m1",
                  request_number: "MR-2026-0017",
                  status: "IN_PROGRESS",
                  priority: "HIGH",
                  description: "Powers on but shows no image.",
                  resolution_notes: null,
                  created_at: "2026-10-04T04:10:00Z",
                  resolved_at: null,
                  cancelled_at: null,
                },
                {
                  id: "m2",
                  request_number: "MR-2026-0004",
                  status: "RESOLVED",
                  priority: "MEDIUM",
                  description: "Fan is very loud.",
                  resolution_notes:
                    "Cleaned the dust filter and replaced the fan.",
                  created_at: "2026-08-14T06:00:00Z",
                  resolved_at: "2026-08-15T10:00:00Z",
                  cancelled_at: null,
                },
              ]}
            />
          </div>
        </Card>

        <div className="lg:col-span-2">
          <AuditLogTable
            rows={DEMO_AUDIT}
            names={{ [DEMO_TECH]: "Ravi Kumar" }}
          />
        </div>

        <Card
          title="QR code"
          description="Generated in the browser for the seeded asset AST-2026-00001."
        >
          <AssetQrCode
            url={getAssetPublicUrl(
              getAppUrl() ?? "http://localhost:3000",
              "AST-2026-00001",
            )}
            publicId="AST-2026-00001"
            withActions
          />
        </Card>

        <div className="lg:col-span-2">
          <Table caption="Sample assets">
            <TableHead>
              <tr>
                <TableHeaderCell>Asset ID</TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Location</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono whitespace-nowrap">
                  AST-2026-00001
                </TableCell>
                <TableCell>Epson Projector P-104</TableCell>
                <TableCell>Vyas / VY001</TableCell>
                <TableCell>
                  <AssetStatusBadge status="AVAILABLE" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono whitespace-nowrap">
                  AST-2026-00002
                </TableCell>
                <TableCell>Dell Latitude 5440 L-201</TableCell>
                <TableCell>Vyas / VY101</TableCell>
                <TableCell>
                  <AssetStatusBadge status="IN_MAINTENANCE" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <EmptyState
          title="No assets found"
          description="Try changing your filters."
          action={<Button variant="secondary">Clear filters</Button>}
        />

        <Card title="Loading">
          <div className="space-y-3">
            <Spinner label="Loading assets…" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
