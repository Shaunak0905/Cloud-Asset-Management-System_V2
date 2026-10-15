"use client";

import { useState } from "react";
import { ArrowRight, QrCode, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export function AssetQuickLookup() {
  const [assetId, setAssetId] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Asset IDs are generated in upper case (AST-2026-00001).
    const trimmed = assetId.trim().toUpperCase();
    if (!trimmed) return;
    router.push(`/asset/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-lg shadow-slate-200/50 backdrop-blur-md transition-all hover:shadow-xl">
      <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5 font-medium text-slate-700">
          <QrCode aria-hidden="true" className="size-4 text-blue-600" />
          <span>Instant Asset Passport Lookup</span>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-blue-600">
          <Sparkles aria-hidden="true" className="size-3" />
          <span>Live Digital ID</span>
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            aria-label="Asset ID"
            placeholder="e.g. AST-2026-00001"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pr-3 pl-9 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-hidden"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
        </div>
        <button
          type="submit"
          disabled={!assetId.trim()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>Inspect</span>
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </button>
      </form>

      <p className="mt-3.5 text-[11px] text-slate-500">
        The asset ID is printed under the QR code on the asset&apos;s label.
      </p>
    </div>
  );
}
