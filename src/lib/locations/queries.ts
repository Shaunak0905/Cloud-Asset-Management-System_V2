import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { BuildingOption } from "./types";

// Reads run as the signed-in user, so RLS decides what is visible.

function loadError(what: string, error: { code?: string; message: string }) {
  console.error(
    `[locations] failed to load ${what}:`,
    error.code,
    error.message,
  );
  return new Error(`Unable to load ${what}.`);
}

export type AdminBuilding = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  roomCount: number;
};

export async function listBuildingsForAdmin(): Promise<AdminBuilding[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select("id, name, code, description, is_active, rooms(count)")
    .order("name");
  if (error) throw loadError("buildings", error);

  return data.map(({ rooms, ...building }) => ({
    ...building,
    roomCount: rooms[0]?.count ?? 0,
  }));
}

export async function getBuildingWithRooms(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select(
      "id, name, code, description, is_active, rooms(id, room_number, display_name, is_active)",
    )
    .eq("id", id)
    .order("room_number", { referencedTable: "rooms" })
    .maybeSingle();
  if (error) throw loadError("building", error);
  return data;
}

/** Active buildings for location pickers, alphabetical. */
export async function listActiveBuildings(): Promise<BuildingOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buildings")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name");
  if (error) throw loadError("buildings", error);
  return data;
}
