import { isIsoDate } from "@/lib/forms";
import { requestNumberParam } from "@/lib/maintenance/schema";

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from "./events";

/** docs/13 §40: always paginate, 20 per page. */
export const AUDIT_PAGE_SIZE = 20;

export type AuditListParams = {
  action: AuditAction | null;
  entityType: AuditEntityType | null;
  /** Part of the actor's name or email. */
  actor: string | null;
  /** An asset ID (AST-…) or request number (MR-…). */
  reference: string | null;
  /** Campus dates, YYYY-MM-DD, both inclusive. */
  from: string | null;
  to: string | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const MAX_PAGE = 10_000;
const ASSET_REFERENCE = /^AST-\d{4}-\d{5,12}$/;

/**
 * Keeps what a name/email search needs and drops everything else, so the
 * text is safe inside a quoted PostgREST filter value.
 */
export function normalizeActorSearch(raw: string): string | null {
  const cleaned = raw
    .replace(/[^\p{L}\p{N} ._@+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();
  return cleaned || null;
}

/** What an asset ID or request number refers to, or null if neither. */
export function referenceKind(reference: string): "asset" | "request" | null {
  if (ASSET_REFERENCE.test(reference)) return "asset";
  if (requestNumberParam.safeParse(reference).success) return "request";
  return null;
}

/** Parses audit filters from the URL; invalid values are ignored. */
export function parseAuditListParams(params: SearchParams): AuditListParams {
  const action = first(params.action);
  const entityType = first(params.entity);
  const reference = first(params.reference).toUpperCase();
  let from = isIsoDate(first(params.from)) ? first(params.from) : null;
  let to = isIsoDate(first(params.to)) ? first(params.to) : null;
  if (from && to && from > to) [from, to] = [to, from];
  const page = Number.parseInt(first(params.page), 10);

  return {
    action: AUDIT_ACTIONS.find((a) => a === action) ?? null,
    entityType: AUDIT_ENTITY_TYPES.find((t) => t === entityType) ?? null,
    actor: normalizeActorSearch(first(params.actor)),
    reference: referenceKind(reference) ? reference : null,
    from,
    to,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

/** The query string for an audit list URL, omitting empty filters and page 1. */
export function auditListQuery(params: AuditListParams): string {
  const query = new URLSearchParams();
  if (params.action) query.set("action", params.action);
  if (params.entityType) query.set("entity", params.entityType);
  if (params.actor) query.set("actor", params.actor);
  if (params.reference) query.set("reference", params.reference);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function hasAuditFilters(params: AuditListParams): boolean {
  return Boolean(
    params.action ||
    params.entityType ||
    params.actor ||
    params.reference ||
    params.from ||
    params.to,
  );
}
