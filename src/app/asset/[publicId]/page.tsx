import { LogIn, MapPin, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicFrame } from "@/components/layout/public-frame";
import { AssetStatusBadge } from "@/components/status-badges";
import { buttonClasses } from "@/components/ui/button";
import { PUBLIC_STATUS_MESSAGES } from "@/lib/assets/public";
import { getPublicAsset } from "@/lib/assets/public-queries";
import { getCurrentUser } from "@/lib/auth/current-user";
import { loginPathWithNext } from "@/lib/auth/routes";

// Public page opened by scanning an asset's QR code. Viewing never changes
// anything: no assignment, no location, no status (docs/00 §26).

export async function generateMetadata({
  params,
}: PageProps<"/asset/[publicId]">): Promise<Metadata> {
  const { publicId } = await params;
  const asset = await getPublicAsset(publicId);
  return {
    title: asset ? asset.name : "Asset not found",
    // Asset pages are for people holding the asset, not for search engines.
    robots: { index: false, follow: false },
  };
}

export default async function PublicAssetPage({
  params,
}: PageProps<"/asset/[publicId]">) {
  const { publicId } = await params;
  const asset = await getPublicAsset(publicId);
  if (!asset) notFound();

  const user = await getCurrentUser();
  const status = PUBLIC_STATUS_MESSAGES[asset.status];

  return (
    <PublicFrame>
      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="font-mono text-sm text-slate-500">{asset.asset_id}</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {asset.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {asset.category}
            {asset.department && <> · {asset.department}</>}
          </p>
        </div>

        <div className="space-y-4 p-5">
          <section aria-labelledby="asset-status-heading">
            <h2 id="asset-status-heading" className="text-sm text-slate-500">
              Status
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <AssetStatusBadge status={asset.status} />
              <span className="font-medium text-slate-900">
                {status.headline}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{status.detail}</p>
          </section>

          <section aria-labelledby="asset-location-heading">
            <h2 id="asset-location-heading" className="text-sm text-slate-500">
              Home location
            </h2>
            <p className="mt-1 flex items-start gap-2 font-medium text-slate-900">
              <MapPin
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-blue-700"
              />
              <span>
                {asset.building_name} / {asset.room_number}
                {asset.room_name && (
                  <span className="block text-sm font-normal text-slate-600">
                    {asset.room_name}
                  </span>
                )}
              </span>
            </p>
          </section>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-5">
          {user ? (
            <div className="space-y-2">
              {asset.status === "AVAILABLE" && (
                <Link
                  href={`/assets/${asset.asset_id}/request`}
                  className={buttonClasses({ className: "w-full" })}
                >
                  Request / use asset
                </Link>
              )}
              <Link
                href={`/assets/${asset.asset_id}`}
                className={buttonClasses({
                  variant:
                    asset.status === "AVAILABLE" ? "secondary" : "primary",
                  className: "w-full",
                })}
              >
                Open asset in the app
              </Link>
              {asset.status !== "RETIRED" && (
                <Link
                  href={`/assets/${asset.asset_id}/report`}
                  className={buttonClasses({
                    variant: "secondary",
                    className: "w-full",
                  })}
                >
                  <TriangleAlert aria-hidden className="size-4" />
                  Report a problem
                </Link>
              )}
            </div>
          ) : (
            <>
              <Link
                href={loginPathWithNext(`/asset/${asset.public_id}`)}
                className={buttonClasses({ className: "w-full" })}
              >
                <LogIn aria-hidden className="size-4" />
                Sign in to request or report a problem
              </Link>
              <p className="mt-2 text-center text-xs text-slate-500">
                Campus accounts only. Viewing this page changes nothing.
              </p>
            </>
          )}
        </div>
      </article>
    </PublicFrame>
  );
}
