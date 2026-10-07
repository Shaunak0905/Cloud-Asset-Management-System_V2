import "server-only";

import { PGRST_RANGE_NOT_SATISFIABLE } from "@/lib/db-errors";
import { campusDayRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { type AuditRow, mentionedProfileIds, type NameLookup } from "./format";
import { AUDIT_PAGE_SIZE, type AuditListParams, referenceKind } from "./schema";

// Audit logs are readable by admins only (RLS: audit_logs_select_admin);
// for anyone else these queries return nothing.

function loadError(what: string, error: { code?: string; message: string }) {
  console.error(`[audit] failed to load ${what}:`, error.code, error.message);
  return new Error(`Unable to load ${what}.`);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

const MAX_MATCHING_ACTORS = 50;

/** Users whose name or email contains the search (already sanitised). */
async function matchingActorIds(supabase: Supabase, search: string) {
  const value = `"%${search}%"`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .or(`full_name.ilike.${value},email.ilike.${value}`)
    .limit(MAX_MATCHING_ACTORS);
  if (error) throw loadError("users", error);
  return data.map((profile) => profile.id);
}

/**
 * The filter for events about an asset or maintenance request: the record
 * itself, plus events that name it in their metadata (e.g. maintenance on
 * an asset, files of a request). Null if the reference does not exist.
 */
async function referenceFilter(
  supabase: Supabase,
  reference: string,
): Promise<string | null> {
  if (referenceKind(reference) === "asset") {
    const { data, error } = await supabase
      .from("assets")
      .select("id")
      .eq("asset_id", reference)
      .maybeSingle();
    if (error) throw loadError("asset", error);
    return data
      ? `entity_id.eq.${data.id},metadata->>asset_id.eq.${reference}`
      : null;
  }
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select("id")
    .eq("request_number", reference)
    .maybeSingle();
  if (error) throw loadError("maintenance request", error);
  return data
    ? `entity_id.eq.${data.id},metadata->>request_number.eq.${reference}`
    : null;
}

async function profileNames(
  supabase: Supabase,
  ids: string[],
): Promise<NameLookup> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  if (error) throw loadError("users", error);
  return Object.fromEntries(
    data.map((profile) => [
      profile.id,
      profile.full_name || profile.email || "A user",
    ]),
  );
}

/** The latest few events, for the admin dashboard (docs/12 §16, docs/13 §54). */
export async function listRecentActivity(limit: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, old_values, new_values, metadata, created_at, actor_id, actor:profiles!audit_logs_actor_id_fkey(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw loadError("recent activity", error);
  const names = await profileNames(supabase, mentionedProfileIds(data));
  return { rows: data, names };
}

export type AuditList = {
  rows: AuditRow[];
  /** null when the page is past the last row. */
  total: number | null;
  names: NameLookup;
};

const EMPTY: AuditList = { rows: [], total: 0, names: {} };

/**
 * One page of audit events, newest first (docs/13 §37–41), with filters for
 * action, entity type, actor, record reference and campus date range. The
 * values used in raw filter strings are validated or sanitised first
 * (schema.ts); ids come from the database.
 */
export async function listAuditLogs(
  params: AuditListParams,
): Promise<AuditList> {
  const supabase = await createClient();

  const actorIds = params.actor
    ? await matchingActorIds(supabase, params.actor)
    : null;
  if (actorIds?.length === 0) return EMPTY;

  const reference = params.reference
    ? await referenceFilter(supabase, params.reference)
    : null;
  if (params.reference && !reference) return EMPTY;

  let query = supabase
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, old_values, new_values, metadata, created_at, actor_id, actor:profiles!audit_logs_actor_id_fkey(full_name, email)",
      { count: "exact" },
    );
  if (params.action) query = query.eq("action", params.action);
  if (params.entityType) query = query.eq("entity_type", params.entityType);
  if (actorIds) query = query.in("actor_id", actorIds);
  if (reference) query = query.or(reference);
  const { since, before } = campusDayRange(params);
  if (since) query = query.gte("created_at", since);
  if (before) query = query.lt("created_at", before);

  const from = (params.page - 1) * AUDIT_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE - 1);

  if (error?.code === PGRST_RANGE_NOT_SATISFIABLE) {
    return { rows: [], total: null, names: {} };
  }
  if (error) throw loadError("audit logs", error);

  const names = await profileNames(supabase, mentionedProfileIds(data));
  return { rows: data, total: count ?? 0, names };
}
