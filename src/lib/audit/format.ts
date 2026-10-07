import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import {
  ASSET_STATUS,
  MAINTENANCE_ACTION,
  MAINTENANCE_PRIORITY,
  MAINTENANCE_STATUS,
} from "@/lib/labels";
import { UPLOAD_KINDS } from "@/lib/storage/files";

import { AUDIT_ENTITY_LABELS, type AuditEntityType } from "./events";

// Turns stored audit rows into what an admin reads (docs/13 §37–38): a
// reference to the record, what changed and a few details. Internal ids and
// storage paths are left out ("do not expose database internals").

export type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  metadata: unknown;
  created_at: string;
  actor_id: string | null;
  actor: { full_name: string; email: string | null } | null;
};

/** Profile id → display name, for ids that appear inside audit payloads. */
export type NameLookup = Readonly<Record<string, string>>;

type Values = Record<string, unknown>;

function record(value: unknown): Values {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Values)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Ids that mean nothing to a reader; the record is linked instead. */
const HIDDEN_KEYS = new Set([
  "asset_id",
  "request_number",
  "document_id",
  "history_entry_id",
  "assignment_id",
  "from_assignment_id",
  "to_assignment_id",
  "registered_building_id",
  "registered_room_id",
  "building_id",
  "room_id",
]);

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  role: "Role",
  is_active: "Active",
  assigned_to: "Technician",
  technician_id: "Technician",
  priority: "Priority",
  name: "Name",
  category: "Category",
  changed_fields: "Changed",
  usage_building: "Used in building",
  usage_room: "Used in room",
  expected_return_at: "Expected return",
  returned_at: "Returned",
  resolved_at: "Resolved",
  final_asset_status: "Asset now",
  document_type: "File type",
  file_type: "Format",
  history_type: "Entry",
  building: "Building",
  room: "Room",
};

const CHANGED_FIELD_LABELS: Record<string, string> = {
  name: "name",
  category: "category",
  serial_number: "serial number",
  department: "department",
  purchase_date: "purchase date",
  warranty_until: "warranty",
  description: "description",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function lookup<T extends string>(
  labels: Record<T, { label: string } | string>,
  value: string,
): string {
  if (!Object.hasOwn(labels, value)) return value;
  const entry = labels[value as T];
  return typeof entry === "string" ? entry : entry.label;
}

/** A stored value as words: labels for enums, names for people, dates. */
export function formatAuditValue(
  key: string,
  value: unknown,
  entityType: string,
  names: NameLookup,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        key === "changed_fields"
          ? (CHANGED_FIELD_LABELS[String(item)] ?? String(item))
          : String(item),
      )
      .join(", ");
  }
  const raw = String(value);
  switch (key) {
    case "status":
      return entityType === "maintenance_request"
        ? lookup(MAINTENANCE_STATUS, raw)
        : lookup(ASSET_STATUS, raw);
    case "final_asset_status":
      return lookup(ASSET_STATUS, raw);
    case "priority":
      return lookup(MAINTENANCE_PRIORITY, raw);
    case "role":
      return lookup(ROLE_LABELS, raw);
    case "assigned_to":
    case "technician_id":
      return names[raw] ?? "a user";
    case "document_type":
      return lookup(UPLOAD_KINDS, raw);
    case "history_type":
      return lookup(MAINTENANCE_ACTION, raw);
    case "expected_return_at":
    case "returned_at":
    case "resolved_at":
      return formatDateTime(raw);
    default:
      return raw;
  }
}

/** The record an event is about, with a link where the app has a page for it. */
export function auditReference(
  row: AuditRow,
  names: NameLookup,
): { label: string; href: string | null } {
  const metadata = record(row.metadata);
  const assetCode =
    text(metadata.asset_id) ?? text(record(row.new_values).asset_id);
  const requestNumber = text(metadata.request_number);

  if (row.entity_type === "maintenance_request" && requestNumber) {
    return { label: requestNumber, href: `/maintenance/${requestNumber}` };
  }
  if (row.entity_type === "asset_document") {
    if (requestNumber) {
      return {
        label: `File · ${requestNumber}`,
        href: `/maintenance/${requestNumber}`,
      };
    }
    if (assetCode) {
      return { label: `File · ${assetCode}`, href: `/assets/${assetCode}` };
    }
  }
  if (row.entity_type === "asset" && assetCode) {
    return { label: assetCode, href: `/assets/${assetCode}` };
  }
  if (row.entity_type === "profile" && row.entity_id) {
    return { label: names[row.entity_id] ?? "A user", href: null };
  }
  const entity = Object.hasOwn(AUDIT_ENTITY_LABELS, row.entity_type)
    ? AUDIT_ENTITY_LABELS[row.entity_type as AuditEntityType]
    : row.entity_type;
  return { label: entity, href: null };
}

/** "VY / VY001" from a location payload ({ building, room }). */
function locationText(values: Values): string | null {
  const building = text(values.building);
  const room = text(values.room);
  return building && room ? `${building} / ${room}` : null;
}

/** Fields that changed, old → new (from old_values / new_values). */
export function auditChanges(
  row: AuditRow,
  names: NameLookup,
): Array<{ field: string; from: string | null; to: string }> {
  const before = record(row.old_values);
  const after = record(row.new_values);

  const fromLocation = locationText(before);
  const toLocation = locationText(after);
  if (fromLocation || toLocation) {
    return [{ field: "Location", from: fromLocation, to: toLocation ?? "—" }];
  }

  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !HIDDEN_KEYS.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({
      field: fieldLabel(key),
      from:
        key in before
          ? formatAuditValue(key, before[key], row.entity_type, names)
          : null,
      to: formatAuditValue(key, after[key], row.entity_type, names),
    }));
}

/** Other useful facts from metadata, as label/value pairs. */
export function auditDetails(
  row: AuditRow,
  names: NameLookup,
): Array<{ label: string; value: string }> {
  const metadata = record(row.metadata);
  return Object.entries(metadata)
    .filter(([key, value]) => !HIDDEN_KEYS.has(key) && value !== null)
    .map(([key, value]) => ({
      label: fieldLabel(key),
      value: formatAuditValue(key, value, row.entity_type, names),
    }));
}

/** Profile ids mentioned inside audit payloads, to look up their names. */
export function mentionedProfileIds(rows: AuditRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.entity_type === "profile" && row.entity_id) ids.add(row.entity_id);
    for (const values of [row.old_values, row.new_values, row.metadata]) {
      const payload = record(values);
      for (const key of ["assigned_to", "technician_id"]) {
        const id = text(payload[key]);
        if (id) ids.add(id);
      }
    }
  }
  return [...ids];
}
