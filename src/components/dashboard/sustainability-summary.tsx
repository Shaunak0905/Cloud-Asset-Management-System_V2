import { Leaf } from "lucide-react";

import { repairRate, type Sustainability } from "@/lib/dashboard/schema";

import { StatCard, StatGrid } from "./stat-card";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * Sustainability figures for the admin dashboard, aligned with UN SDG 12
 * (Responsible Consumption and Production): how often broken equipment is
 * repaired rather than replaced, how much equipment is shared instead of
 * bought, and which repairs a warranty may cover. `null` means the figures
 * could not be loaded.
 */
export function SustainabilitySummary({
  data,
}: {
  data: Sustainability | null;
}) {
  const rate = data ? repairRate(data.repairs) : null;

  return (
    <div>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Leaf aria-hidden className="size-3.5" />
          </span>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">
            Sustainability
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          UN SDG 12, responsible consumption: repairing and sharing equipment
          instead of buying new. Totals for all records.
        </p>
      </div>

      {data ? (
        <StatGrid label="Sustainability" className="grid-cols-2 sm:grid-cols-4">
          <StatCard
            label="Repaired instead of replaced"
            value={rate ?? 0}
            display={rate === null ? "—" : `${rate}%`}
            href="/admin/maintenance?status=RESOLVED"
            hint={
              rate === null
                ? "No repairs finished yet"
                : `${data.repairs.repaired} back in service · ${data.repairs.still_damaged} still damaged · ${data.repairs.retired} retired`
            }
          />
          <StatCard
            label="Times equipment was shared"
            value={data.sharing.loans}
            hint={`${plural(data.sharing.assets_shared, "asset")} used by more than one person`}
          />
          <StatCard
            label="Reported under warranty"
            value={data.warranty.reported_under_warranty}
            hint="Problems the supplier may repair free"
          />
          <StatCard
            label="Open, still under warranty"
            value={data.warranty.open_under_warranty}
            tone="warning"
            hint="Check with the supplier before the warranty ends"
          />
        </StatGrid>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
          Sustainability figures are unavailable right now.
        </p>
      )}
    </div>
  );
}
