"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

import { describedBy, Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { fetchActiveRooms } from "@/lib/locations/rooms-client";
import {
  type BuildingOption,
  type RoomOption,
  roomLabel,
} from "@/lib/locations/types";

export type LocationValue = {
  buildingId: string | null;
  roomId: string | null;
};

type BuildingRoomSelectorProps = {
  /** Selectable buildings (normally the active ones). */
  buildings: BuildingOption[];
  defaultBuildingId?: string | null;
  defaultRoomId?: string | null;
  /** Rooms of `defaultBuildingId`, rendered without a loading step. */
  initialRooms?: RoomOption[];
  /** Form field names submitted with the surrounding <form>. */
  buildingFieldName?: string;
  roomFieldName?: string;
  buildingLabel?: string;
  roomLabel?: string;
  idPrefix?: string;
  disabled?: boolean;
  errors?: { building?: string; room?: string };
  onChange?: (value: LocationValue) => void;
  /** Loads a building's rooms; defaults to an RLS-protected Supabase query. */
  loadRooms?: (buildingId: string) => Promise<RoomOption[]>;
};

/**
 * Dependent Building → Room dropdowns (docs/10 §17). The room list is loaded
 * for the chosen building and the room resets whenever the building changes.
 * This is UX only: the database rejects rooms that are not in the building.
 */
export function BuildingRoomSelector({
  buildings,
  defaultBuildingId,
  defaultRoomId,
  initialRooms,
  buildingFieldName = "buildingId",
  roomFieldName = "roomId",
  buildingLabel = "Building",
  roomLabel: roomFieldLabel = "Room",
  idPrefix,
  disabled = false,
  errors,
  onChange,
  loadRooms,
}: BuildingRoomSelectorProps) {
  const generatedId = useId();
  const buildingId = `${idPrefix ?? generatedId}-building`;
  const roomId = `${idPrefix ?? generatedId}-room`;

  const [building, setBuilding] = useState(defaultBuildingId ?? "");
  const [room, setRoom] = useState(defaultRoomId ?? "");
  const [roomsByBuilding, setRoomsByBuilding] = useState<
    Record<string, RoomOption[]>
  >(() =>
    defaultBuildingId && initialRooms
      ? { [defaultBuildingId]: initialRooms }
      : {},
  );
  const [failedBuilding, setFailedBuilding] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);

  // Always call the latest loader without refetching when its identity changes.
  const loaderRef = useRef(loadRooms ?? fetchActiveRooms);
  useEffect(() => {
    loaderRef.current = loadRooms ?? fetchActiveRooms;
  });

  const rooms = building ? roomsByBuilding[building] : undefined;
  const status: "idle" | "loading" | "error" | "loaded" = !building
    ? "idle"
    : rooms
      ? "loaded"
      : failedBuilding === building
        ? "error"
        : "loading";

  useEffect(() => {
    if (!building || roomsByBuilding[building] || failedBuilding === building)
      return;

    // Rooms are cached per building, so a late response can never show the
    // wrong rooms; this flag just skips updates for an abandoned request.
    let current = true;
    loaderRef.current(building).then(
      (loaded) => {
        if (current)
          setRoomsByBuilding((all) => ({ ...all, [building]: loaded }));
      },
      () => {
        if (current) setFailedBuilding(building);
      },
    );
    return () => {
      current = false;
    };
  }, [building, roomsByBuilding, failedBuilding, retries]);

  function handleBuildingChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    setBuilding(next);
    setRoom("");
    setFailedBuilding(null);
    onChange?.({ buildingId: next || null, roomId: null });
  }

  function handleRoomChange(event: ChangeEvent<HTMLSelectElement>) {
    setRoom(event.target.value);
    onChange?.({
      buildingId: building || null,
      roomId: event.target.value || null,
    });
  }

  function retry() {
    setFailedBuilding(null);
    setRetries((count) => count + 1);
  }

  const roomPlaceholder = {
    idle: "Select a building first",
    loading: "Loading rooms…",
    error: "Rooms unavailable",
    loaded: rooms?.length ? "Select a room" : "No rooms in this building",
  }[status];

  const roomDisabled = disabled || status !== "loaded" || !rooms?.length;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id={buildingId} label={buildingLabel} error={errors?.building}>
        <Select
          id={buildingId}
          name={buildingFieldName}
          value={building}
          onChange={handleBuildingChange}
          disabled={disabled}
          aria-invalid={errors?.building ? true : undefined}
          aria-describedby={describedBy(buildingId, {
            error: errors?.building,
          })}
        >
          <option value="">Select a building</option>
          {buildings.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} ({option.code})
            </option>
          ))}
        </Select>
      </Field>

      <Field id={roomId} label={roomFieldLabel} error={errors?.room}>
        <Select
          id={roomId}
          name={roomFieldName}
          value={room}
          onChange={handleRoomChange}
          disabled={roomDisabled}
          aria-busy={status === "loading"}
          aria-invalid={errors?.room ? true : undefined}
          aria-describedby={describedBy(roomId, { error: errors?.room })}
        >
          <option value="">{roomPlaceholder}</option>
          {rooms?.map((option) => (
            <option key={option.id} value={option.id}>
              {roomLabel(option)}
            </option>
          ))}
        </Select>
        {status === "error" && (
          <p role="alert" className="text-sm text-red-700">
            Unable to load rooms.{" "}
            <button
              type="button"
              onClick={retry}
              className="font-medium underline underline-offset-2 hover:text-red-900"
            >
              Try again
            </button>
          </p>
        )}
      </Field>
    </div>
  );
}
