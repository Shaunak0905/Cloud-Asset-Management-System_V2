// Audit events (docs/13-audit-logging.md §7, §48). Every event is written by
// the database — workflow functions and triggers — in the same transaction as
// the change, with the actor taken from auth.uid(); clients cannot insert,
// edit or delete audit rows. This file is the one list of event names the
// app knows, with labels for the audit log page. tests/db/audit.test.ts fails
// if a migration writes an event that is missing here, or vice versa.

export const AUDIT_ACTION_LABELS = {
  ASSET_CREATED: "Asset created",
  ASSET_UPDATED: "Asset details changed",
  ASSET_STATUS_CHANGED: "Asset status changed",
  ASSET_RETIRED: "Asset retired",
  ASSET_REGISTERED_LOCATION_CHANGED: "Home location changed",
  ASSET_ASSIGNED: "Asset assigned",
  ASSET_RETURNED: "Asset returned",
  ASSET_TRANSFERRED: "Asset transferred",
  ASSET_IMAGE_UPLOADED: "Asset photo uploaded",
  MAINTENANCE_CREATED: "Problem reported",
  MAINTENANCE_ASSIGNED: "Technician assigned",
  MAINTENANCE_STARTED: "Work started",
  MAINTENANCE_HISTORY_ADDED: "Work note added",
  MAINTENANCE_EVIDENCE_UPLOADED: "Evidence uploaded",
  MAINTENANCE_RESOLVED: "Request resolved",
  MAINTENANCE_CANCELLED: "Request cancelled",
  DOCUMENT_DELETED: "File deleted",
  ROLE_CHANGED: "Role changed",
  ACCOUNT_ACTIVATED: "Account activated",
  ACCOUNT_DEACTIVATED: "Account deactivated",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTION_LABELS;

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

/** Groups for the action filter, in the order they are offered. */
export const AUDIT_ACTION_GROUPS: ReadonlyArray<{
  label: string;
  actions: readonly AuditAction[];
}> = [
  {
    label: "Assets",
    actions: [
      "ASSET_CREATED",
      "ASSET_UPDATED",
      "ASSET_STATUS_CHANGED",
      "ASSET_RETIRED",
      "ASSET_REGISTERED_LOCATION_CHANGED",
      "ASSET_ASSIGNED",
      "ASSET_RETURNED",
      "ASSET_TRANSFERRED",
    ],
  },
  {
    label: "Maintenance",
    actions: [
      "MAINTENANCE_CREATED",
      "MAINTENANCE_ASSIGNED",
      "MAINTENANCE_STARTED",
      "MAINTENANCE_HISTORY_ADDED",
      "MAINTENANCE_RESOLVED",
      "MAINTENANCE_CANCELLED",
    ],
  },
  {
    label: "Files",
    actions: [
      "ASSET_IMAGE_UPLOADED",
      "MAINTENANCE_EVIDENCE_UPLOADED",
      "DOCUMENT_DELETED",
    ],
  },
  {
    label: "Accounts",
    actions: ["ROLE_CHANGED", "ACCOUNT_ACTIVATED", "ACCOUNT_DEACTIVATED"],
  },
];

/** Entity types allowed by the audit_logs check constraint. */
export const AUDIT_ENTITY_LABELS = {
  asset: "Asset",
  asset_assignment: "Assignment",
  maintenance_request: "Maintenance request",
  maintenance_history: "Maintenance history",
  asset_document: "File",
  profile: "User",
  building: "Building",
  room: "Room",
} as const;

export type AuditEntityType = keyof typeof AUDIT_ENTITY_LABELS;

export const AUDIT_ENTITY_TYPES = Object.keys(
  AUDIT_ENTITY_LABELS,
) as AuditEntityType[];

export function auditActionLabel(action: string): string {
  return Object.hasOwn(AUDIT_ACTION_LABELS, action)
    ? AUDIT_ACTION_LABELS[action as AuditAction]
    : action;
}
