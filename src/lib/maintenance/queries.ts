import "server-only";

import { PGRST_RANGE_NOT_SATISFIABLE } from "@/lib/db-errors";
import { campusDayRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import {
  isRequestNumberSearch,
  isStatusIn,
  MAINTENANCE_PAGE_SIZE,
  type MaintenanceListParams,
  OPEN_WORK_STATUSES,
  UNASSIGNED,
} from "./schema";

// Reads run as the signed-in user: RLS shows reporters their own requests,
// technicians the ones assigned to them, and admins everything.
// (Select strings stay single literals so the typed client can infer rows.)

function loadError(what: string, error: { code?: string; message: string }) {
  console.error(
    `[maintenance] failed to load ${what}:`,
    error.code,
    error.message,
  );
  return new Error(`Unable to load ${what}.`);
}

/** Requests the user reported, newest first. */
export async function listMyReports(userId: string, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * MAINTENANCE_PAGE_SIZE;
  const { data, count, error } = await supabase
    .from("maintenance_requests")
    .select(
      "id, request_number, status, priority, created_at, assets(asset_id, name)",
      { count: "exact" },
    )
    .eq("reported_by", userId)
    .order("created_at", { ascending: false })
    .range(from, from + MAINTENANCE_PAGE_SIZE - 1);

  if (error?.code === PGRST_RANGE_NOT_SATISFIABLE)
    return { rows: [], total: null };
  if (error) throw loadError("maintenance requests", error);
  return { rows: data, total: count ?? 0 };
}

/**
 * Maintenance list with search, filters and pagination. A search that looks
 * like a request number matches request numbers; anything else matches the
 * asset's ID or name.
 *
 * With `assignedTo` this is a technician's queue: only their requests, open
 * work (ASSIGNED / IN_PROGRESS) unless a status is chosen, and open work
 * ordered most urgent first, then oldest first (docs/08 §42). Otherwise
 * newest first.
 */
export async function listMaintenanceRequests(
  params: MaintenanceListParams,
  { assignedTo }: { assignedTo?: string } = {},
) {
  const supabase = await createClient();
  let query = supabase
    .from("maintenance_requests")
    .select(
      "id, request_number, status, priority, created_at, assets!inner(asset_id, name, buildings(name), rooms!assets_registered_room_fkey(room_number)), technician:profiles!maintenance_requests_assigned_to_fkey(full_name, email)",
      { count: "exact" },
    );

  // Filter values are encoded by the query builder; free text is
  // pre-sanitised by normalizeSearch() and quoted inside or().
  if (params.search) {
    const value = `"%${params.search}%"`;
    query = isRequestNumberSearch(params.search)
      ? query.ilike("request_number", `%${params.search}%`)
      : query.or(`asset_id.ilike.${value},name.ilike.${value}`, {
          referencedTable: "assets",
        });
  }
  if (assignedTo) {
    query = query.eq("assigned_to", assignedTo);
    if (!params.status) query = query.in("status", OPEN_WORK_STATUSES);
  }
  if (params.status) query = query.eq("status", params.status);
  if (params.priority) query = query.eq("priority", params.priority);
  if (params.technician === UNASSIGNED) query = query.is("assigned_to", null);
  else if (params.technician)
    query = query.eq("assigned_to", params.technician);
  const { since, before } = campusDayRange(params);
  if (since) query = query.gte("created_at", since);
  if (before) query = query.lt("created_at", before);

  const queue =
    assignedTo !== undefined &&
    (!params.status || isStatusIn(params.status, OPEN_WORK_STATUSES));
  // The priority enum is ordered LOW..CRITICAL, so descending is most urgent.
  if (params.sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (params.sort === "priority" || (!params.sort && queue)) {
    query = query
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true });
  } else if (params.sort === "updated") {
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const from = (params.page - 1) * MAINTENANCE_PAGE_SIZE;
  const { data, count, error } = await query.range(
    from,
    from + MAINTENANCE_PAGE_SIZE - 1,
  );

  if (error?.code === PGRST_RANGE_NOT_SATISFIABLE)
    return { rows: [], total: null };
  if (error) throw loadError("maintenance requests", error);
  return { rows: data, total: count ?? 0 };
}

/** One request with its asset and people, or null if not visible. */
export async function getMaintenanceRequest(requestNumber: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_requests")
    .select(
      "id, request_number, status, priority, description, resolution_notes, cancellation_reason, created_at, assigned_at, resolved_at, cancelled_at, reported_by, assigned_to, assets(asset_id, name, category, status, buildings(name, code), rooms!assets_registered_room_fkey(room_number, display_name)), reporter:profiles!maintenance_requests_reported_by_fkey(full_name, email), technician:profiles!maintenance_requests_assigned_to_fkey(full_name, email)",
    )
    .eq("request_number", requestNumber)
    .maybeSingle();
  if (error) throw loadError("maintenance request", error);
  return data;
}

export type MaintenanceRequestDetail = NonNullable<
  Awaited<ReturnType<typeof getMaintenanceRequest>>
>;

const ASSET_HISTORY_LIMIT = 10;

/**
 * An asset's maintenance requests, newest first (docs/08 §33). RLS decides
 * how much of the history a viewer gets: admins see every request; others
 * only the ones they reported or are assigned to.
 */
export async function listAssetMaintenance(assetUuid: string) {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("maintenance_requests")
    .select(
      "id, request_number, status, priority, description, resolution_notes, created_at, resolved_at, cancelled_at",
      { count: "exact" },
    )
    .eq("asset_id", assetUuid)
    .order("created_at", { ascending: false })
    .limit(ASSET_HISTORY_LIMIT);
  if (error) throw loadError("maintenance history", error);
  return { rows: data, total: count ?? 0 };
}

/** Longest work log a request page shows; real requests stay far below. */
const HISTORY_LIMIT = 200;

/**
 * A request's history, oldest first. RLS shows it to admins and the assigned
 * technician only; reporters get an empty list. `performer` is null when the
 * viewer may not see that profile (e.g. a technician viewing an admin's entry).
 */
export async function listMaintenanceHistory(requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_history")
    .select(
      "id, action, notes, performed_at, performed_by, performer:profiles!maintenance_history_performed_by_fkey(full_name)",
    )
    .eq("maintenance_request_id", requestId)
    .order("performed_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);
  if (error) throw loadError("maintenance history", error);
  return data;
}

export type MaintenanceHistoryEntry = Awaited<
  ReturnType<typeof listMaintenanceHistory>
>[number];

/** Active technicians, for the admin's assignment list (docs/08 §16). */
export async function listActiveTechnicians() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "TECHNICIAN")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) throw loadError("technicians", error);
  return data;
}

export type TechnicianOption = Awaited<
  ReturnType<typeof listActiveTechnicians>
>[number];

/** Open reports on an asset (number, status and date only), for anyone. */
export async function listOpenMaintenance(assetUuid: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_open_maintenance", {
    p_asset_id: assetUuid,
  });
  if (error) throw loadError("open maintenance requests", error);
  return data;
}
