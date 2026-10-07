// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BuildingOption, RoomOption } from "@/lib/locations/types";

import { BuildingRoomSelector } from "./building-room-selector";

// Scenarios from docs/14-testing-and-quality-assurance.md §12.

const VYAS: BuildingOption = { id: "b-vy", name: "Vyas", code: "VY" };
const VIVEKANANDA: BuildingOption = {
  id: "b-vk",
  name: "Vivekananda",
  code: "VK",
};

const ROOMS: Record<string, RoomOption[]> = {
  "b-vy": [
    { id: "r-vy001", room_number: "VY001", display_name: "Seminar Hall" },
    { id: "r-vy101", room_number: "VY101", display_name: null },
  ],
  "b-vk": [
    { id: "r-vk301", room_number: "VK301", display_name: null },
    { id: "r-vk404", room_number: "VK404", display_name: "Classroom 404" },
  ],
};

/** A loader whose responses the test resolves by hand. */
function controllableLoader() {
  const pending = new Map<
    string,
    { resolve: (r: RoomOption[]) => void; reject: () => void }
  >();
  const load = vi.fn(
    (buildingId: string) =>
      new Promise<RoomOption[]>((resolve, reject) => {
        pending.set(buildingId, {
          resolve,
          reject: () => reject(new Error("fail")),
        });
      }),
  );
  return {
    load,
    resolve: (id: string) =>
      act(async () => pending.get(id)!.resolve(ROOMS[id])),
    reject: (id: string) => act(async () => pending.get(id)!.reject()),
  };
}

function buildingSelect() {
  return screen.getByRole("combobox", {
    name: "Building",
  }) as HTMLSelectElement;
}
function roomSelect() {
  return screen.getByRole("combobox", { name: "Room" }) as HTMLSelectElement;
}
function roomOptions() {
  return Array.from(roomSelect().options)
    .filter((option) => option.value)
    .map((option) => option.textContent);
}

describe("BuildingRoomSelector", () => {
  it("disables_the_room_dropdown_until_a_building_is_chosen", () => {
    render(
      <BuildingRoomSelector
        buildings={[VYAS, VIVEKANANDA]}
        loadRooms={vi.fn()}
      />,
    );
    expect(buildingSelect().value).toBe("");
    expect(roomSelect()).toBeDisabled();
    expect(roomSelect()).toHaveDisplayValue("Select a building first");
  });

  it("loads_and_lists_only_the_chosen_buildings_rooms", async () => {
    const loader = controllableLoader();
    render(
      <BuildingRoomSelector
        buildings={[VYAS, VIVEKANANDA]}
        loadRooms={loader.load}
      />,
    );

    fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });
    expect(loader.load).toHaveBeenCalledWith("b-vy");
    expect(roomSelect()).toBeDisabled();
    expect(roomSelect()).toHaveDisplayValue("Loading rooms…");

    await loader.resolve("b-vy");
    expect(roomSelect()).toBeEnabled();
    expect(roomOptions()).toEqual(["VY001 — Seminar Hall", "VY101"]);
  });

  it("resets_the_room_and_swaps_the_options_when_the_building_changes", async () => {
    const loader = controllableLoader();
    const onChange = vi.fn();
    render(
      <BuildingRoomSelector
        buildings={[VYAS, VIVEKANANDA]}
        loadRooms={loader.load}
        onChange={onChange}
      />,
    );

    fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });
    await loader.resolve("b-vy");
    fireEvent.change(roomSelect(), { target: { value: "r-vy001" } });
    expect(roomSelect().value).toBe("r-vy001");

    fireEvent.change(buildingSelect(), { target: { value: "b-vk" } });
    expect(roomSelect().value).toBe("");
    expect(onChange).toHaveBeenLastCalledWith({
      buildingId: "b-vk",
      roomId: null,
    });

    await loader.resolve("b-vk");
    expect(roomOptions()).toEqual(["VK301", "VK404 — Classroom 404"]);
    expect(roomOptions()).not.toContain("VY001 — Seminar Hall");

    // Going back must not resurrect the earlier room choice.
    fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });
    expect(roomSelect().value).toBe("");
  });

  it("reuses_rooms_it_has_already_loaded", async () => {
    const loader = controllableLoader();
    render(
      <BuildingRoomSelector
        buildings={[VYAS, VIVEKANANDA]}
        loadRooms={loader.load}
      />,
    );

    fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });
    await loader.resolve("b-vy");
    fireEvent.change(buildingSelect(), { target: { value: "b-vk" } });
    await loader.resolve("b-vk");
    fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });

    expect(loader.load).toHaveBeenCalledTimes(2);
    expect(roomOptions()).toEqual(["VY001 — Seminar Hall", "VY101"]);
  });

  it("ignores_a_late_response_for_a_building_no_longer_selected", async () => {
    const loader = controllableLoader();
    render(
      <BuildingRoomSelector
        buildings={[VYAS, VIVEKANANDA]}
        loadRooms={loader.load}
      />,
    );

    fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });
    fireEvent.change(buildingSelect(), { target: { value: "b-vk" } });
    await loader.resolve("b-vk");
    await loader.resolve("b-vy"); // arrives last

    expect(roomOptions()).toEqual(["VK301", "VK404 — Classroom 404"]);
  });

  it("shows_an_error_and_can_retry", async () => {
    const loader = controllableLoader();
    render(<BuildingRoomSelector buildings={[VYAS]} loadRooms={loader.load} />);

    fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });
    await loader.reject("b-vy");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to load rooms.",
    );
    expect(roomSelect()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(loader.load).toHaveBeenCalledTimes(2);
    await loader.resolve("b-vy");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(roomOptions()).toHaveLength(2);
  });

  it("explains_when_a_building_has_no_rooms", async () => {
    render(
      <BuildingRoomSelector
        buildings={[VYAS]}
        loadRooms={() => Promise.resolve([])}
      />,
    );
    await act(async () => {
      fireEvent.change(buildingSelect(), { target: { value: "b-vy" } });
    });
    expect(roomSelect()).toBeDisabled();
    expect(roomSelect()).toHaveDisplayValue("No rooms in this building");
  });

  it("starts_from_an_existing_selection_without_loading", () => {
    const load = vi.fn();
    render(
      <BuildingRoomSelector
        buildings={[VYAS, VIVEKANANDA]}
        defaultBuildingId="b-vk"
        defaultRoomId="r-vk404"
        initialRooms={ROOMS["b-vk"]}
        loadRooms={load}
      />,
    );
    expect(buildingSelect().value).toBe("b-vk");
    expect(roomSelect().value).toBe("r-vk404");
    expect(load).not.toHaveBeenCalled();
  });

  it("submits_both_values_with_the_form", async () => {
    render(
      <form data-testid="form">
        <BuildingRoomSelector
          buildings={[VYAS]}
          buildingFieldName="usageBuildingId"
          roomFieldName="usageRoomId"
          defaultBuildingId="b-vy"
          defaultRoomId="r-vy101"
          initialRooms={ROOMS["b-vy"]}
          loadRooms={vi.fn()}
        />
      </form>,
    );
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(Object.fromEntries(data)).toEqual({
      usageBuildingId: "b-vy",
      usageRoomId: "r-vy101",
    });
  });

  it("can_be_disabled_entirely", () => {
    render(
      <BuildingRoomSelector
        buildings={[VYAS]}
        defaultBuildingId="b-vy"
        initialRooms={ROOMS["b-vy"]}
        disabled
        loadRooms={vi.fn()}
      />,
    );
    expect(buildingSelect()).toBeDisabled();
    expect(roomSelect()).toBeDisabled();
  });

  it("shows_validation_errors_on_the_right_field", () => {
    render(
      <BuildingRoomSelector
        buildings={[VYAS]}
        errors={{ room: "Select a room." }}
        loadRooms={vi.fn()}
      />,
    );
    expect(roomSelect()).toHaveAttribute("aria-invalid", "true");
    expect(roomSelect()).toHaveAccessibleDescription("Select a room.");
    expect(buildingSelect()).not.toHaveAttribute("aria-invalid");
  });
});
