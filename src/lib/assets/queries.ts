import "server-only";

import { PGRST_RANGE_NOT_SATISFIABLE } from "@/lib/db-errors";
import type { BuildingOption, RoomOption } from "@/lib/locations/types";
import { createClient } from "@/lib/supabase/server";

import { ASSETS_PAGE_SIZE } from "./constants";
import type { AssetListParams } from "./schema";

// Reads run as the signed-in user, so RLS decides what is visible.
// (Select strings stay single literals so the typed client can infer rows.)

function loadError(what: string, error: { code?: string; message: string }) {
  console.error(`[assets] failed to load ${what}:`, error.code, error.message);
  return new Error(`Unable to load ${what}.`);
}

export async function listAssets(params: AssetListParams) {
  const supabase = await createClient();

  let query = supabase
    .from("assets")
    .select(
      "id, asset_id, name, category, department, status, serial_number, buildings(name, code), rooms!assets_registered_room_fkey(room_number)",
      { count: "exact" },
    );

  // The query builder encodes filter values. The free-text search is
  // pre-sanitised by normalizeSearch() and quoted inside the or() filter.
  if (params.search) {
    const value = `"%${params.search}%"`;
    query = query.or(
      `asset_id.ilike.${value},name.ilike.${value},serial_number.ilike.${value},category.ilike.${value}`,
    );
  }
  if (params.status) query = query.eq("status", params.status);
  if (params.category) query = query.eq("category", params.category);
  if (params.buildingId)
    query = query.eq("registered_building_id", params.buildingId);
  if (params.department) query = query.eq("department", params.department);

  switch (params.sort) {
    case "name":
      query = query.order("name").order("asset_id");
      break;
    case "asset_id":
      query = query.order("asset_id");
      break;
    case "updated":
      query = query.order("updated_at", { ascending: false }).order("asset_id");
      break;
    case "warranty":
      // Soonest first; assets without a warranty date at the end.
      query = query
        .order("warranty_until", { ascending: true, nullsFirst: false })
        .order("asset_id");
      break;
    default:
      query = query.order("created_at", { ascending: false }).order("asset_id");
  }

  const from = (params.page - 1) * ASSETS_PAGE_SIZE;
  const { data, count, error } = await query.range(
    from,
    from + ASSETS_PAGE_SIZE - 1,
  );

  if (error?.code === PGRST_RANGE_NOT_SATISFIABLE) {
    // Page past the end (e.g. an old link): show an empty page.
    return { rows: [], total: null };
  }
  if (error) throw loadError("assets", error);
  return { rows: data, total: count ?? 0 };
}

export type AssetListRow = NonNullable<
  Awaited<ReturnType<typeof listAssets>>["rows"]
>[number];

export async function getAssetByAssetId(assetId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, asset_id, public_id, name, category, serial_number, department, status, purchase_date, warranty_until, description, created_at, updated_at, archived_at, registered_building_id, registered_room_id, buildings(id, name, code), rooms!assets_registered_room_fkey(id, room_number, display_name)",
    )
    .eq("asset_id", assetId)
    .maybeSingle();
  if (error) throw loadError("asset", error);
  return data;
}

export type AssetDetail = NonNullable<
  Awaited<ReturnType<typeof getAssetByAssetId>>
>;

/** All buildings (including inactive) for list filters. */
export async function listBuildingFilterOptions(): Promise<BuildingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select("id, name, code")
    .order("name");
  if (error) throw loadError("buildings", error);
  return data;
}

export async function listDepartments(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_asset_departments");
  if (error) throw loadError("departments", error);
  return data ?? [];
}

/**
 * Rooms for the registered-location picker when editing: the building's
 * active rooms plus the asset's current room even if it was deactivated.
 * `currentRoomId` comes from the database row, never from user input.
 */
export async function listRoomsForEdit(
  buildingId: string,
  currentRoomId: string,
): Promise<RoomOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, room_number, display_name")
    .eq("building_id", buildingId)
    .or(`is_active.eq.true,id.eq.${currentRoomId}`)
    .order("room_number");
  if (error) throw loadError("rooms", error);
  return data;
}
