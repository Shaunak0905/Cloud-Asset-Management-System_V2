import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetQrCode } from "@/components/qr/asset-qr-code";
import { PrintButton } from "@/components/qr/print-button";
import { Alert } from "@/components/ui/alert";
import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { getAssetByAssetId } from "@/lib/assets/queries";
import { assetIdParam } from "@/lib/assets/schema";
import { requireRole } from "@/lib/auth/current-user";
import { getAppUrl } from "@/lib/env";
import { getAssetPublicUrl, isLocalAddress } from "@/lib/qr";

export const metadata: Metadata = { title: "Print QR label" };

/**
 * Print-ready QR sticker. The label shows only the asset ID and name — never
 * private data (docs/07-qr-system.md §14).
 */
export default async function AssetLabelPage({
  params,
}: PageProps<"/admin/assets/[assetId]/label">) {
  await requireRole(["ADMIN"]);

  const { assetId } = await params;
  if (!assetIdParam.safeParse(assetId).success) notFound();
  const asset = await getAssetByAssetId(assetId);
  if (!asset) notFound();

  const appUrl = getAppUrl();
  const publicUrl = appUrl ? getAssetPublicUrl(appUrl, asset.public_id) : null;

  return (
    <>
      <div className="print:hidden">
        <BackLink href={`/assets/${asset.asset_id}`}>Back to asset</BackLink>
        <PageHeader
          title="Print QR label"
          description="Print on a sticker and attach it to the asset. Cut along the dashed line."
          actions={publicUrl && <PrintButton />}
        />
        {publicUrl && isLocalAddress(publicUrl) && (
          <Alert
            tone="warning"
            title="Not for physical labels"
            className="mb-6"
          >
            This label points to a local development address. Print real
            stickers from the production site so every phone can open them.
          </Alert>
        )}
      </div>

      {publicUrl ? (
        <div className="mx-auto w-[3in] rounded-md border-2 border-dashed border-slate-300 bg-white p-4 text-center print:mt-0 print:border-slate-400">
          <AssetQrCode url={publicUrl} publicId={asset.public_id} size={240} />
          <p className="mt-2 font-mono text-lg font-semibold tracking-wide text-slate-900">
            {asset.asset_id}
          </p>
          <p className="text-sm text-slate-700">{asset.name}</p>
          <p className="mt-1 text-xs text-slate-500">Scan to view this asset</p>
        </div>
      ) : (
        <Alert tone="warning" title="QR codes unavailable">
          Set NEXT_PUBLIC_APP_URL to the site&apos;s address to print labels.
        </Alert>
      )}
    </>
  );
}
