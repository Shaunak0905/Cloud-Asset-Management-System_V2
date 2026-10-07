// Maintenance choices and guidance shown in client forms. Kept free of zod
// so those forms do not ship it; ./schema re-exports everything here.

import type { Enums } from "@/types/database";

type MaintenancePriority = Enums<"maintenance_priority">;
type MaintenanceAction = Enums<"maintenance_action">;

/** What each priority means (docs/08 §9), shown to the person reporting. */
export const PRIORITY_GUIDANCE: Record<MaintenancePriority, string> = {
  LOW: "Minor issue. The asset can still be used normally.",
  MEDIUM: "Something doesn't work, but the asset can still be used.",
  HIGH: "Badly impaired. It should not be used until it is repaired.",
  CRITICAL: "Unusable or unsafe.",
};

/**
 * Priorities that take an available asset out of service. Mirrors
 * private.asset_needs_service (tests/db/maintenance.test.ts).
 */
export const OUT_OF_SERVICE_PRIORITIES: readonly MaintenancePriority[] = [
  "HIGH",
  "CRITICAL",
];

/**
 * History entries people add themselves. The other actions (REPORTED,
 * ASSIGNED, STARTED, RESOLVED, CANCELLED) are written only by workflow steps.
 * Mirrors the maintenance_history insert policy (tests/db/technician.test.ts).
 */
export const WORK_NOTE_ACTIONS = [
  "INSPECTION",
  "DIAGNOSIS",
  "REPAIR",
  "PART_REPLACEMENT",
  "TESTING",
  "NOTE",
] as const satisfies readonly MaintenanceAction[];
