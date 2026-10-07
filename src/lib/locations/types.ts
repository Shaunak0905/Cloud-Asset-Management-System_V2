import type { Tables } from "@/types/database";

export type BuildingOption = Pick<Tables<"buildings">, "id" | "name" | "code">;

export type RoomOption = Pick<
  Tables<"rooms">,
  "id" | "room_number" | "display_name"
>;

/** "Vyas / VY001" (docs use this building / room format throughout). */
export function locationLabel(
  building: { name: string } | null | undefined,
  room: { room_number: string } | null | undefined,
): string {
  if (!building || !room) return "—";
  return `${building.name} / ${room.room_number}`;
}

/** "VY001 — Seminar Hall", or just the room number. */
export function roomLabel(
  room: Pick<RoomOption, "room_number" | "display_name">,
): string {
  return room.display_name
    ? `${room.room_number} — ${room.display_name}`
    : room.room_number;
}
