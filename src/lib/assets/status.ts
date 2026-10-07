import type { Enums } from "@/types/database";

export type AssetStatus = Enums<"asset_status">;

/**
 * Status changes an admin may make by hand (docs/06-asset-management.md §16).
 * The database enforces the same transitions; ASSIGNED is entered and left
 * only through the assignment workflow, so it never appears here.
 * (tests/db/assets.test.ts checks this table against the database.)
 */
const MANUAL_TARGETS: Record<AssetStatus, AssetStatus[]> = {
  AVAILABLE: ["IN_MAINTENANCE", "DAMAGED", "LOST", "RETIRED"],
  ASSIGNED: [],
  IN_MAINTENANCE: ["AVAILABLE", "DAMAGED", "RETIRED"],
  DAMAGED: ["IN_MAINTENANCE", "AVAILABLE", "RETIRED"],
  LOST: ["AVAILABLE", "RETIRED"],
  RETIRED: [],
};

export function manualStatusTargets(from: AssetStatus): AssetStatus[] {
  return MANUAL_TARGETS[from];
}

export function canChangeStatusManually(
  from: AssetStatus,
  to: AssetStatus,
): boolean {
  return MANUAL_TARGETS[from].includes(to);
}
