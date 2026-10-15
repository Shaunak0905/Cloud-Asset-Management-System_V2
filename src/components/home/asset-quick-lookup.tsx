"use client";

import { useState } from "react";
import { ArrowRight, QrCode, Search, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = [
  { id: "DL-5440-88213", label: "Dell Laptop" },
  { id: "EP-ABC-12345", label: "Epson Projector" },
  { id: "HP-ED800-44120", label: "HP Desktop" },
  { id: "ARD-UNO-0707", label: "Arduino Kit" },
];

export function AssetQuickLookup() {
  const [assetId, setAssetId] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = assetId.trim();
    if (!trimmed) return;
    router.push(`/asset/${encodeURIComponent(trimmed)}`);
  }

  function handleQuickSelect(id: string) {
    setAssetId(id);
    router.push(`/asset/${encodeURIComponent(id)}`);
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

      <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
            placeholder="Enter public Asset ID or serial (e.g. DL-5440-88213)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-hidden"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
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

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span className="text-[11px] font-medium text-slate-400">Quick test sample:</span>
        {SUGGESTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleQuickSelect(item.id)}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700"
          >
            <span>{item.label}</span>
            <span className="font-mono text-[10px] text-slate-400">({item.id})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
