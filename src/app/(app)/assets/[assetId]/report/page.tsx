import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportProblemForm } from "@/components/maintenance/report-problem-form";
import {
  AssetStatusBadge,
  MaintenanceStatusBadge,
} from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAssetByAssetId } from "@/lib/assets/queries";
import { assetIdParam } from "@/lib/assets/schema";
import { requireUser } from "@/lib/auth/current-user";
import { formatCampusDate } from "@/lib/format";
import { locationLabel } from "@/lib/locations/types";
import { reportProblem } from "@/lib/maintenance/actions";
import { listOpenMaintenance } from "@/lib/maintenance/queries";

export const metadata: Metadata = { title: "Report a problem" };

export default async function ReportProblemPage({
  params,
}: PageProps<"/assets/[assetId]/report">) {
  await requireUser();

  const { assetId } = await params;
  if (!assetIdParam.safeParse(assetId).success) notFound();
  const asset = await getAssetByAssetId(assetId);
  if (!asset) notFound();

  const backHref = `/assets/${asset.asset_id}`;
  const retired = asset.status === "RETIRED";
  const openReports = retired ? [] : await listOpenMaintenance(asset.id);

  return (
    <div className="max-w-2xl">
      <BackLink href={backHref}>Back to asset</BackLink>
      <PageHeader title="Report a problem" />

      <Card className="mb-6">
        <p className="font-mono text-sm text-slate-500">{asset.asset_id}</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">
          {asset.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <AssetStatusBadge status={asset.status} />
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-4 text-slate-400" />
            {locationLabel(asset.buildings, asset.rooms)}
          </span>
        </div>
      </Card>

      {retired ? (
        <Alert tone="warning" title="This asset has been retired">
          <p>Problems can no longer be reported for retired assets.</p>
          <Link
            href={backHref}
            className={buttonClasses({
              variant: "secondary",
              size: "sm",
              className: "mt-3",
            })}
          >
            Back to asset
          </Link>
        </Alert>
      ) : (
        <>
          {openReports.length > 0 && (
            <Alert
              tone="warning"
              title="This asset already has an open problem report"
              className="mb-6"
            >
              <ul className="mt-1 space-y-1">
                {openReports.map((report) => (
                  <li
                    key={report.request_number}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="font-mono">{report.request_number}</span>
                    <MaintenanceStatusBadge status={report.status} />
                    <span>reported {formatCampusDate(report.created_at)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                If it is the same problem there is no need to report it again.
                You can still report a different problem below.
              </p>
            </Alert>
          )}
          <Card>
            <ReportProblemForm
              action={reportProblem.bind(null, asset.id, asset.asset_id)}
              assetStatus={asset.status}
              cancelHref={backHref}
            />
          </Card>
        </>
      )}
    </div>
  );
}
