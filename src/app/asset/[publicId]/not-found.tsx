import { SearchX } from "lucide-react";
import Link from "next/link";

import { PublicFrame } from "@/components/layout/public-frame";
import { buttonClasses } from "@/components/ui/button";

/** Shown for an unknown or malformed public ID (docs/07-qr-system.md §19). */
export default function AssetNotFound() {
  return (
    <PublicFrame>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <SearchX aria-hidden className="mx-auto size-10 text-slate-400" />
        <h1 className="mt-3 text-xl font-semibold text-slate-900">
          Asset not found
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This QR code does not correspond to a registered asset.
        </p>
        <Link href="/" className={buttonClasses({ className: "mt-6" })}>
          Back to home
        </Link>
      </div>
    </PublicFrame>
  );
}
