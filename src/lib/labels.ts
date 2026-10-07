import type { Enums } from "@/types/database";

export type BadgeTone =
  "neutral" | "blue" | "green" | "amber" | "red" | "purple";

export type Display = { label: string; tone: BadgeTone };

// Human-readable labels for database enums. Records keyed by the enum type,
// so adding a database value without a label is a type error.

export const ASSET_STATUS: Record<Enums<"asset_status">, Display> = {
  AVAILABLE: { label: "Available", tone: "green" },
  ASSIGNED: { label: "Assigned", tone: "blue" },
  IN_MAINTENANCE: { label: "In maintenance", tone: "amber" },
  DAMAGED: { label: "Damaged", tone: "red" },
  LOST: { label: "Lost", tone: "purple" },
  RETIRED: { label: "Retired", tone: "neutral" },
};

export const ASSIGNMENT_STATUS: Record<Enums<"assignment_status">, Display> = {
  ACTIVE: { label: "Active", tone: "blue" },
  RETURNED: { label: "Returned", tone: "green" },
  TRANSFERRED: { label: "Transferred", tone: "purple" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const MAINTENANCE_STATUS: Record<
  Enums<"maintenance_status">,
  Display
> = {
  OPEN: { label: "Open", tone: "blue" },
  ASSIGNED: { label: "Assigned", tone: "purple" },
  IN_PROGRESS: { label: "In progress", tone: "amber" },
  RESOLVED: { label: "Resolved", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/** Maintenance history entries: workflow steps and technician work notes. */
export const MAINTENANCE_ACTION: Record<Enums<"maintenance_action">, string> = {
  REPORTED: "Reported",
  ASSIGNED: "Technician assigned",
  STARTED: "Work started",
  INSPECTION: "Inspection",
  DIAGNOSIS: "Diagnosis",
  REPAIR: "Repair",
  PART_REPLACEMENT: "Part replaced",
  TESTING: "Testing",
  NOTE: "Note",
  RESOLVED: "Resolved",
  CANCELLED: "Cancelled",
};

export const MAINTENANCE_PRIORITY: Record<
  Enums<"maintenance_priority">,
  Display
> = {
  LOW: { label: "Low", tone: "neutral" },
  MEDIUM: { label: "Medium", tone: "blue" },
  HIGH: { label: "High", tone: "amber" },
  CRITICAL: { label: "Critical", tone: "red" },
};
