import {
  ArrowRightLeft,
  HandHelping,
  MapPin,
  Pencil,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AssetStatusControl } from "@/components/assets/asset-status-control";
import { ReturnAssetButton } from "@/components/assignments/return-asset-button";
import { DeleteFileButton } from "@/components/files/delete-file-button";
import { FileUploader } from "@/components/files/file-uploader";
import { AssetMaintenanceHistory } from "@/components/maintenance/asset-maintenance-history";
import { StoredImage } from "@/components/files/stored-image";
import { AssetQrCode } from "@/components/qr/asset-qr-code";
import {
  AssetStatusBadge,
  AssignmentStatusBadge,
  MaintenanceStatusBadge,
} from "@/components/status-badges";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { changeAssetStatus } from "@/lib/assets/actions";
import { getAssetByAssetId } from "@/lib/assets/queries";
import { assetIdParam } from "@/lib/assets/schema";
import { returnAsset } from "@/lib/assignments/actions";
import {
  getVisibleActiveAssignment,
  listAssetAssignments,
} from "@/lib/assignments/queries";
import { isOverdue } from "@/lib/assignments/status";
import { requireUser } from "@/lib/auth/current-user";
import { canManageAssets } from "@/lib/auth/permissions";
import { getAppUrl } from "@/lib/env";
import {
  formatCampusDate,
  formatDate,
  formatDateTime,
  warrantyState,
} from "@/lib/format";
import { locationLabel } from "@/lib/locations/types";
import {
  listAssetMaintenance,
  listOpenMaintenance,
} from "@/lib/maintenance/queries";
import { getAssetPublicUrl, isLocalAddress } from "@/lib/qr";
import { deleteDocument, registerAssetImage } from "@/lib/storage/actions";
import { getAssetImage } from "@/lib/storage/queries";

export const metadata: Metadata = { title: "Asset" };

const ASSET_PHOTO_TYPES = ["ASSET_IMAGE"] as const;

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export default async function AssetPage({
  params,
}: PageProps<"/assets/[assetId]">) {
  const user = await requireUser();

  const { assetId } = await params;
  if (!assetIdParam.safeParse(assetId).success) notFound();
  const asset = await getAssetByAssetId(assetId);
  if (!asset) notFound();

  const isAdmin = canManageAssets(user);
  const warranty = warrantyState(asset.warranty_until);
  const appUrl = getAppUrl();
  const publicUrl = appUrl ? getAssetPublicUrl(appUrl, asset.public_id) : null;
  // RLS: assignments are visible only to the person using the asset and to
  // admins.
  const retired = asset.status === "RETIRED";
  const [assignment, history, openReports, photo, maintenance] =
    await Promise.all([
      asset.status === "ASSIGNED" ? getVisibleActiveAssignment(asset.id) : null,
      isAdmin ? listAssetAssignments(asset.id) : null,
      retired ? [] : listOpenMaintenance(asset.id),
      getAssetImage(asset.id),
      listAssetMaintenance(asset.id),
    ]);
  const holderName =
    assignment?.profiles?.full_name ?? assignment?.profiles?.email;

  return (
    <>
      <BackLink href={isAdmin ? "/admin/assets" : "/assets"}>
        All assets
      </BackLink>
      <PageHeader
        title={asset.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{asset.asset_id}</span>
            <AssetStatusBadge status={asset.status} />
          </span>
        }
        actions={
          <>
            {asset.status === "AVAILABLE" && (
              <Link
                href={`/assets/${asset.asset_id}/request`}
                className={buttonClasses()}
              >
                <HandHelping aria-hidden className="size-4" />
                Request / use asset
              </Link>
            )}
            {isAdmin && asset.status === "AVAILABLE" && (
              <Link
                href={`/admin/assets/${asset.asset_id}/assign`}
                className={buttonClasses({ variant: "secondary" })}
              >
                <UserPlus aria-hidden className="size-4" />
                Assign to someone
              </Link>
            )}
            {!retired && (
              <Link
                href={`/assets/${asset.asset_id}/report`}
                className={buttonClasses({ variant: "secondary" })}
              >
                <TriangleAlert aria-hidden className="size-4" />
                Report a problem
              </Link>
            )}
            {isAdmin && !retired && (
              <Link
                href={`/admin/assets/${asset.asset_id}/edit`}
                className={buttonClasses({ variant: "secondary" })}
              >
                <Pencil aria-hidden className="size-4" />
                Edit asset
              </Link>
            )}
          </>
        }
      />

      {openReports.length > 0 && (
        <Alert tone="warning" title="Open problem reports" className="mb-6">
          <ul className="space-y-1">
            {openReports.map((report) => (
              <li
                key={report.request_number}
                className="flex flex-wrap items-center gap-2"
              >
                {isAdmin ? (
                  <Link
                    href={`/maintenance/${report.request_number}`}
                    className="font-mono font-medium underline"
                  >
                    {report.request_number}
                  </Link>
                ) : (
                  <span className="font-mono">{report.request_number}</span>
                )}
                <MaintenanceStatusBadge status={report.status} />
                <span>reported {formatCampusDate(report.created_at)}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {retired && (
        <Alert tone="info" title="Retired asset" className="mb-6">
          Retired on {formatDateTime(asset.archived_at)}. It can no longer be
          requested, and its history is preserved.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(photo || isAdmin) && (
            <Card title="Photo">
              {photo ? (
                <StoredImage
                  documentId={photo.id}
                  alt={`Photo of ${asset.name}`}
                  className="max-h-80 w-full object-contain"
                />
              ) : (
                <p className="text-sm text-slate-600">No photo uploaded yet.</p>
              )}
              {isAdmin && (
                <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                  <FileUploader
                    types={ASSET_PHOTO_TYPES}
                    entityId={asset.id}
                    register={registerAssetImage.bind(
                      null,
                      asset.id,
                      asset.asset_id,
                    )}
                    buttonLabel={photo ? "Replace photo" : "Upload photo"}
                    successMessage={
                      photo ? "Photo replaced." : "Photo uploaded."
                    }
                  />
                  {photo && (
                    <DeleteFileButton
                      action={deleteDocument.bind(
                        null,
                        photo.id,
                        asset.asset_id,
                        null,
                      )}
                      fileName={photo.original_filename}
                      label="Remove photo"
                    />
                  )}
                </div>
              )}
            </Card>
          )}

          <Card title="Registered location">
            <div className="flex items-start gap-3">
              <MapPin aria-hidden className="mt-0.5 size-5 text-blue-700" />
              <div>
                <p className="font-medium text-slate-900">
                  {locationLabel(asset.buildings, asset.rooms)}
                </p>
                {asset.rooms?.display_name && (
                  <p className="text-sm text-slate-600">
                    {asset.rooms.display_name}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  Where this asset normally belongs. Temporary use elsewhere
                  does not change it.
                </p>
              </div>
            </div>
          </Card>

          {asset.status === "ASSIGNED" && (
            <Card title="Current use">
              {assignment ? (
                <>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Detail label="Being used at">
                      {locationLabel(assignment.buildings, assignment.rooms)}
                      {assignment.rooms?.display_name && (
                        <span className="block font-normal text-slate-600">
                          {assignment.rooms.display_name}
                        </span>
                      )}
                    </Detail>
                    <Detail label="Assigned to">
                      {assignment.user_id === user.id
                        ? "You"
                        : (holderName ?? "—")}
                      {isAdmin && assignment.profiles?.email && (
                        <span className="block font-normal text-slate-600">
                          {assignment.profiles.email}
                        </span>
                      )}
                    </Detail>
                    <Detail label="Since">
                      {formatDateTime(assignment.assigned_at)}
                    </Detail>
                    <Detail label="Expected return">
                      {formatDateTime(assignment.expected_return_at)}
                      {isOverdue("ACTIVE", assignment.expected_return_at) && (
                        <Badge tone="red" className="ml-2">
                          Overdue
                        </Badge>
                      )}
                    </Detail>
                    {assignment.notes && (
                      <div className="sm:col-span-2">
                        <Detail label="Notes">
                          <span className="font-normal whitespace-pre-line">
                            {assignment.notes}
                          </span>
                        </Detail>
                      </div>
                    )}
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                    <ReturnAssetButton
                      action={returnAsset.bind(
                        null,
                        assignment.id,
                        asset.asset_id,
                      )}
                      assetName={asset.name}
                      onBehalfOf={
                        assignment.user_id === user.id
                          ? undefined
                          : (holderName ?? "the current user")
                      }
                      size="sm"
                    />
                    {isAdmin && (
                      <Link
                        href={`/admin/assets/${asset.asset_id}/assign`}
                        className={buttonClasses({
                          variant: "secondary",
                          size: "sm",
                        })}
                      >
                        <ArrowRightLeft aria-hidden className="size-4" />
                        Transfer
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-600">
                  This asset is currently in use by someone else.
                </p>
              )}
            </Card>
          )}

          <Card title="Details">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail label="Category">{asset.category}</Detail>
              <Detail label="Serial number">
                {asset.serial_number ? (
                  <span className="font-mono">{asset.serial_number}</span>
                ) : (
                  "—"
                )}
              </Detail>
              <Detail label="Department">{asset.department ?? "—"}</Detail>
              <Detail label="Purchase date">
                {formatDate(asset.purchase_date)}
              </Detail>
              <Detail label="Warranty">
                {warranty.kind === "none" ? (
                  "—"
                ) : warranty.kind === "active" ? (
                  <>Until {formatDate(warranty.until)}</>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Badge tone="amber">Expired</Badge>
                    {formatDate(warranty.until)}
                  </span>
                )}
              </Detail>
              <Detail label="Registered on">
                {formatCampusDate(asset.created_at)}
              </Detail>
            </dl>
            {asset.description && (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <h3 className="text-sm text-slate-500">Description</h3>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-900">
                  {asset.description}
                </p>
              </div>
            )}
          </Card>

          {(isAdmin || maintenance.rows.length > 0) && (
            <Card
              title="Maintenance history"
              description={
                isAdmin
                  ? maintenance.total > maintenance.rows.length
                    ? `Latest ${maintenance.rows.length} of ${maintenance.total}.`
                    : "Every problem reported for this asset."
                  : "Reports on this asset that you made or are handling."
              }
            >
              <AssetMaintenanceHistory items={maintenance.rows} />
            </Card>
          )}

          {history && (
            <Card
              title="Assignment history"
              description={
                history.total > history.rows.length
                  ? `Latest ${history.rows.length} of ${history.total}.`
                  : "Who has used this asset, and where."
              }
            >
              {history.rows.length === 0 ? (
                <p className="text-sm text-slate-600">
                  This asset has not been assigned yet.
                </p>
              ) : (
                <ol className="divide-y divide-slate-200">
                  {history.rows.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {entry.profiles?.full_name ??
                            entry.profiles?.email ??
                            "—"}
                        </p>
                        <p className="text-sm text-slate-600">
                          Used at {locationLabel(entry.buildings, entry.rooms)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(entry.assigned_at)} –{" "}
                          {entry.returned_at
                            ? formatDateTime(entry.returned_at)
                            : "now"}
                        </p>
                      </div>
                      <AssignmentStatusBadge status={entry.status} />
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}
        </div>

        {isAdmin && (
          <div className="space-y-6">
            <Card
              title="Status"
              description="Only allowed status changes are offered."
            >
              <AssetStatusControl
                status={asset.status}
                action={changeAssetStatus.bind(null, asset.id)}
              />
            </Card>

            <Card
              title="QR code"
              description="Opens this asset's public page. Reprinting always gives the same code."
            >
              {publicUrl ? (
                <div className="space-y-4">
                  {isLocalAddress(publicUrl) && (
                    <Alert tone="warning" title="Development address">
                      This code points to a local address, so phones elsewhere
                      cannot open it. Use it for testing only and print physical
                      labels from the production site.
                    </Alert>
                  )}
                  <AssetQrCode
                    url={publicUrl}
                    publicId={asset.public_id}
                    withActions
                    printHref={`/admin/assets/${asset.asset_id}/label`}
                  />
                  <p className="text-center text-xs break-all text-slate-500">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-700 hover:underline"
                    >
                      {publicUrl}
                    </a>
                  </p>
                </div>
              ) : (
                <Alert tone="warning" title="QR codes unavailable">
                  Set NEXT_PUBLIC_APP_URL to the site&apos;s address to generate
                  QR codes.
                </Alert>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
