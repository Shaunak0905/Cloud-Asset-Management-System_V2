import { z } from "zod";

import { normalizeSearch } from "@/lib/assets/schema";
import { isIsoDate, requiredId } from "@/lib/forms";
import { Constants, type Enums } from "@/types/database";

import { WORK_NOTE_ACTIONS } from "./options";

export type MaintenancePriority = Enums<"maintenance_priority">;
export type MaintenanceStatus = Enums<"maintenance_status">;
export type MaintenanceAction = Enums<"maintenance_action">;

export const MAINTENANCE_PAGE_SIZE = 20;

/** SQLSTATEs raised by the maintenance workflow functions (see migrations). */
export const MAINTENANCE_ERRORS = {
  retired: "CA006",
  closed: "CA007",
  notTechnician: "CA008",
  wrongStep: "CA009",
  invalidAssetState: "CA010",
} as const;

/** Requests that are not closed: they can still be (re)assigned. */
export const UNFINISHED_STATUSES = [
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
] as const satisfies readonly MaintenanceStatus[];

/**
 * A technician's open work: the default technician queue, and the statuses
 * in which work notes can be added (mirrors the maintenance_history insert
 * policy).
 */
export const OPEN_WORK_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
] as const satisfies readonly MaintenanceStatus[];

export function isStatusIn(
  status: MaintenanceStatus,
  statuses: readonly MaintenanceStatus[],
): boolean {
  return statuses.includes(status);
}

export {
  OUT_OF_SERVICE_PRIORITIES,
  PRIORITY_GUIDANCE,
  WORK_NOTE_ACTIONS,
} from "./options";

/** Plain-language progress shown to the person who reported the problem. */
export const STATUS_EXPLANATIONS: Record<MaintenanceStatus, string> = {
  OPEN: "Reported. Waiting for a technician to be assigned.",
  ASSIGNED: "A technician has been assigned and will look at it.",
  IN_PROGRESS: "A technician is working on it.",
  RESOLVED: "The work is finished and the request is closed.",
  CANCELLED: "Closed without a repair.",
};

export const REPORT_FORM_FIELDS = ["description", "priority"] as const;

export const reportProblemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Describe the problem.")
    .max(2000, "Keep the description to 2000 characters or fewer."),
  priority: z.enum(
    Constants.public.Enums.maintenance_priority,
    "Choose how serious the problem is.",
  ),
});

// --- Technician workflow ----------------------------------------------------------

export const TECHNICIAN_FORM_FIELDS = ["technicianId"] as const;

export const assignTechnicianSchema = z.object({
  technicianId: requiredId("Choose a technician."),
});

export const WORK_NOTE_FORM_FIELDS = ["action", "notes"] as const;

export const workNoteSchema = z.object({
  action: z.enum(WORK_NOTE_ACTIONS, "Choose what kind of entry this is."),
  notes: z
    .string()
    .trim()
    .min(1, "Write what you found or did.")
    .max(2000, "Keep the note to 2000 characters or fewer."),
});

// --- Resolution and cancellation ----------------------------------------------------

export const RESOLVE_FORM_FIELDS = ["resolutionNotes", "assetStatus"] as const;

/**
 * Whether a final asset state is required depends on the asset's current
 * status, so the database decides that (CA010); here an empty choice means
 * "leave the asset as it is".
 */
export const resolveSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .min(1, "Describe what was done.")
    .max(4000, "Keep this to 4000 characters or fewer."),
  assetStatus: z
    .enum(["", "AVAILABLE", "DAMAGED", "RETIRED"], "Choose a state.")
    .transform((value) => (value === "" ? null : value)),
});

export const CANCEL_FORM_FIELDS = ["reason"] as const;

export const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Say why the request is being cancelled.")
    .max(500, "Keep the reason to 500 characters or fewer."),
});

/** Maintenance request numbers in URLs, e.g. MR-2026-0017. */
export const requestNumberParam = z.string().regex(/^MR-\d{4}-\d{4,12}$/);

// --- List filters (URL search params) ------------------------------------------------

/** Orders a list can be sorted in besides its default (docs/08 §42). */
export const MAINTENANCE_SORTS = {
  oldest: "Oldest first",
  priority: "Most urgent first",
  updated: "Recently updated",
} as const;

export type MaintenanceSort = keyof typeof MAINTENANCE_SORTS;

/** The technician filter: one technician's requests, or nobody's yet. */
export const UNASSIGNED = "unassigned";

export type MaintenanceListParams = {
  search: string | null;
  status: MaintenanceStatus | null;
  priority: MaintenancePriority | null;
  /** A technician's id, or UNASSIGNED (admin list). */
  technician: string | null;
  /** Reported between these campus dates (YYYY-MM-DD, inclusive). */
  from: string | null;
  to: string | null;
  sort: MaintenanceSort | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const MAX_PAGE = 10_000;

/** Parses list filters from the URL; invalid values are ignored. */
export function parseMaintenanceListParams(
  params: SearchParams,
): MaintenanceListParams {
  const status = first(params.status);
  const priority = first(params.priority);
  const technician = first(params.technician);
  const sort = first(params.sort);
  let from = isIsoDate(first(params.from)) ? first(params.from) : null;
  let to = isIsoDate(first(params.to)) ? first(params.to) : null;
  if (from && to && from > to) [from, to] = [to, from];
  const page = Number.parseInt(first(params.page), 10);
  return {
    search: normalizeSearch(first(params.search)),
    status:
      Constants.public.Enums.maintenance_status.find((s) => s === status) ??
      null,
    priority:
      Constants.public.Enums.maintenance_priority.find((p) => p === priority) ??
      null,
    technician:
      technician === UNASSIGNED || z.uuid().safeParse(technician).success
        ? technician.toLowerCase()
        : null,
    from,
    to,
    sort: Object.hasOwn(MAINTENANCE_SORTS, sort)
      ? (sort as MaintenanceSort)
      : null,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

/** The query string for a list URL, omitting empty filters and page 1. */
export function maintenanceListQuery(params: MaintenanceListParams): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.priority) query.set("priority", params.priority);
  if (params.technician) query.set("technician", params.technician);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.sort) query.set("sort", params.sort);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

/** True when the list is narrowed down (sorting alone does not count). */
export function hasMaintenanceFilters(params: MaintenanceListParams): boolean {
  return Boolean(
    params.search ||
    params.status ||
    params.priority ||
    params.technician ||
    params.from ||
    params.to,
  );
}

/** Searches that look like a request number match request numbers only. */
export function isRequestNumberSearch(search: string): boolean {
  return /^MR[-\d]/i.test(search);
}
