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
import { requestAsset } from "@/lib/assignments/actions";
import { requireUser } from "@/lib/auth/current-user";
import { campusDateTimeInputValue } from "@/lib/format";
import { listActiveBuildings } from "@/lib/locations/queries";
import { locationLabel } from "@/lib/locations/types";

export const metadata: Metadata = { title: "Request asset" };

export default async function RequestAssetPage({
  params,
}: PageProps<"/assets/[assetId]/request">) {
  await requireUser();

  const { assetId } = await params;
  if (!assetIdParam.safeParse(assetId).success) notFound();
  const asset = await getAssetByAssetId(assetId);
  if (!asset) notFound();

  const backHref = `/assets/${asset.asset_id}`;
  const buildings =
    asset.status === "AVAILABLE" ? await listActiveBuildings() : [];

  return (
    <div className="max-w-2xl">
      <BackLink href={backHref}>Back to asset</BackLink>
      <PageHeader title="Request / use asset" />

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
      </Card>

      {asset.status === "AVAILABLE" ? (
        <Card>
          <p className="mb-5 text-sm text-slate-600">
            Choose where you will use the asset. Its home location stays{" "}
            {locationLabel(asset.buildings, asset.rooms)}.
          </p>
          <AssignmentForm
            action={requestAsset.bind(null, asset.id, asset.asset_id)}
            buildings={buildings}
            minReturn={campusDateTimeInputValue()}
            cancelHref={backHref}
          />
        </Card>
      ) : (
        <Alert tone="warning" title="This asset is currently unavailable">
          <p>Only available assets can be requested.</p>
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
