import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssignmentForm } from "@/components/assignments/assignment-form";
import { AssetStatusBadge } from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getAssetByAssetId } from "@/lib/assets/queries";
import { assetIdParam } from "@/lib/assets/schema";
import { assignAsset } from "@/lib/assignments/actions";
import { getVisibleActiveAssignment } from "@/lib/assignments/queries";
import { requireRole } from "@/lib/auth/current-user";
import { campusDateTimeInputValue, formatDateTime } from "@/lib/format";
import { listActiveBuildings } from "@/lib/locations/queries";
import { locationLabel } from "@/lib/locations/types";

export const metadata: Metadata = { title: "Assign asset" };

/**
 * Admin: give an available asset to someone, or transfer an assigned one
 * (docs/06 §22). A transfer keeps the current assignment as history.
 */
export default async function AssignAssetPage({
  params,
}: PageProps<"/admin/assets/[assetId]/assign">) {
  await requireRole(["ADMIN"]);

  const { assetId } = await params;
  if (!assetIdParam.safeParse(assetId).success) notFound();
  const asset = await getAssetByAssetId(assetId);
  if (!asset) notFound();

  const backHref = `/assets/${asset.asset_id}`;
  const current =
    asset.status === "ASSIGNED"
      ? await getVisibleActiveAssignment(asset.id)
      : null;
  const canAssign =
    asset.status === "AVAILABLE" || (asset.status === "ASSIGNED" && current);
  const buildings = canAssign ? await listActiveBuildings() : [];
  const holder = current?.profiles?.full_name ?? current?.profiles?.email;

  return (
    <div className="max-w-2xl">
      <BackLink href={backHref}>Back to asset</BackLink>
      <PageHeader
        title={current ? "Transfer asset" : "Assign asset"}
        description={
          current
            ? "Hand this asset to someone else or move it to another room. The current assignment is kept in its history."
            : "Give this asset to someone. It will appear in their assignments."
        }
      />

      <Card className="mb-6">
        <p className="font-mono text-sm text-slate-500">{asset.asset_id}</p>
        <p className="mt-0.5 text-lg font-semibold text-slate-900">
          {asset.name}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <AssetStatusBadge status={asset.status} />
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-4 text-slate-400" />
            Home: {locationLabel(asset.buildings, asset.rooms)}
          </span>
        </div>
        {current && (
          <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">
            Currently with{" "}
            <span className="font-medium text-slate-900">
              {holder ?? "another user"}
            </span>{" "}
            at {locationLabel(current.buildings, current.rooms)} since{" "}
            {formatDateTime(current.assigned_at)}.
          </p>
        )}
      </Card>

      {canAssign ? (
        <Card>
          <AssignmentForm
            action={assignAsset.bind(
              null,
              asset.id,
              asset.asset_id,
              current?.id ?? null,
            )}
            buildings={buildings}
            minReturn={campusDateTimeInputValue()}
            cancelHref={backHref}
            withRecipient
            locationLegend="Where will it be used?"
            submitLabel={current ? "Transfer asset" : "Assign asset"}
          />
        </Card>
      ) : (
        <Alert tone="warning" title="This asset cannot be assigned now">
          <p>
            Only available assets can be assigned, and only assigned assets can
            be transferred.
          </p>
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
      )}
    </div>
  );
}
