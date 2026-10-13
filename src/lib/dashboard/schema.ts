import { z } from "zod";

import { Constants, type Enums } from "@/types/database";

// Shapes of the dashboard functions' JSON results
// (supabase/migrations/…_dashboards.sql). Parsed rather than cast, so a
// mismatch shows up as a clear error instead of a wrong number on screen.

const count = z.number().int().nonnegative();

const distribution = z.array(
  z.object({ key: z.string(), label: z.string(), count }),
);

export const adminDashboardSchema = z.object({
  assets_by_status: z.partialRecord(
    z.enum(Constants.public.Enums.asset_status),
    count,
  ),
  maintenance_by_status: z.partialRecord(
    z.enum(Constants.public.Enums.maintenance_status),
    count,
  ),
  open_by_priority: z.partialRecord(
    z.enum(Constants.public.Enums.maintenance_priority),
    count,
  ),
  unassigned_serious: count,
  resolved_this_month: count,
  active_assignments: count,
  overdue_assignments: count,
  assets_by_category: distribution,
  assets_by_building: distribution,
  technicians: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      assigned: count,
      in_progress: count,
      resolved_this_month: count,
    }),
  ),
});

export const technicianDashboardSchema = z.object({
  assigned: count,
  in_progress: count,
  serious: count,
  resolved_this_month: count,
});

export const myDashboardSchema = z.object({
  active_assignments: count,
  overdue_assignments: count,
  open_reports: count,
});

/** sustainability_dashboard: repair, sharing and warranty counts (SDG 12). */
export const sustainabilitySchema = z.object({
  repairs: z.object({ repaired: count, still_damaged: count, retired: count }),
  sharing: z.object({ loans: count, assets_shared: count }),
  warranty: z.object({
    reported_under_warranty: count,
    open_under_warranty: count,
  }),
});

export type Sustainability = z.infer<typeof sustainabilitySchema>;

/**
 * Share of finished repairs that put the asset back into service, as a
 * whole percentage; null before any repair is finished.
 */
export function repairRate(repairs: Sustainability["repairs"]): number | null {
  const finished = repairs.repaired + repairs.still_damaged + repairs.retired;
  return finished === 0
    ? null
    : Math.round((repairs.repaired / finished) * 100);
}

/** Statuses with no rows are missing from a GROUP BY; they count as 0. */
export function withZeros<K extends string>(
  counts: Partial<Record<K, number>>,
  keys: readonly K[],
): Record<K, number> {
  return Object.fromEntries(
    keys.map((key) => [key, counts[key] ?? 0]),
  ) as Record<K, number>;
}

export type AdminDashboard = Omit<
  z.infer<typeof adminDashboardSchema>,
  "assets_by_status" | "maintenance_by_status" | "open_by_priority"
> & {
  assets_by_status: Record<Enums<"asset_status">, number>;
  maintenance_by_status: Record<Enums<"maintenance_status">, number>;
  open_by_priority: Record<Enums<"maintenance_priority">, number>;
  total_assets: number;
};

/** Parses the admin dashboard result and fills in the missing zeros. */
export function parseAdminDashboard(raw: unknown): AdminDashboard {
  const parsed = adminDashboardSchema.parse(raw);
  const assets = withZeros(
    parsed.assets_by_status,
    Constants.public.Enums.asset_status,
  );
  return {
    ...parsed,
    assets_by_status: assets,
    maintenance_by_status: withZeros(
      parsed.maintenance_by_status,
      Constants.public.Enums.maintenance_status,
    ),
    open_by_priority: withZeros(
      parsed.open_by_priority,
      Constants.public.Enums.maintenance_priority,
    ),
    total_assets: Object.values<number>(assets).reduce((a, b) => a + b, 0),
  };
}
