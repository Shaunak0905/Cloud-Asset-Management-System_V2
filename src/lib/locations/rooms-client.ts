import { createClient } from "@/lib/supabase/client";

import type { RoomOption } from "./types";

/** Active rooms of a building, loaded in the browser as the signed-in user (RLS applies). */
export async function fetchActiveRooms(
  buildingId: string,
): Promise<RoomOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, room_number, display_name")
    .eq("building_id", buildingId)
    .eq("is_active", true)
    .order("room_number");
  if (error) {
    console.error("[locations] failed to load rooms:", error.code);
    throw new Error("Unable to load rooms.");
  }
  return data;
}
