// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

import { AssetForm } from "./asset-form";
import { AssetStatusControl } from "./asset-status-control";

vi.mock("@/lib/locations/rooms-client", () => ({
  fetchActiveRooms: vi.fn(async (buildingId: string) =>
    buildingId === "b-vk"
      ? [{ id: "r-vk404", room_number: "VK404", display_name: null }]
      : [{ id: "r-vy001", room_number: "VY001", display_name: null }],
  ),
}));

const BUILDINGS = [
  { id: "b-vy", name: "Vyas", code: "VY" },
  { id: "b-vk", name: "Vivekananda", code: "VK" },
];

function select(name: string) {
  return screen.getByRole("combobox", { name }) as HTMLSelectElement;
}

describe("AssetForm", () => {
  it("keeps_the_chosen_building_and_room_when_the_server_returns_errors", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({
      status: "error",
      fieldErrors: {
        serialNumber: ["Another asset already has this serial number."],
      },
    }));
    render(
      <AssetForm
        action={action}
        buildings={BUILDINGS}
        departmentSuggestions={[]}
        today="2026-09-29"
        submitLabel="Create asset"
        cancelHref="/admin/assets"
      />,
    );

    fireEvent.change(screen.getByLabelText("Asset name"), {
      target: { value: "Projector" },
    });
    await act(async () => {
      fireEvent.change(select("Registered building"), {
        target: { value: "b-vk" },
      });
    });
    fireEvent.change(select("Registered room"), {
      target: { value: "r-vk404" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create asset" }));
    });

    // The action received the selection...
    const submitted = action.mock.calls[0] as unknown as [FormState, FormData];
    expect(submitted[1].get("buildingId")).toBe("b-vk");
    expect(submitted[1].get("roomId")).toBe("r-vk404");
    // ...the error is shown, and nothing the admin entered was cleared.
    expect(
      screen.getByText("Another asset already has this serial number."),
    ).toBeInTheDocument();
    expect(select("Registered building").value).toBe("b-vk");
    expect(select("Registered room").value).toBe("r-vk404");
    expect(screen.getByLabelText("Asset name")).toHaveValue("Projector");
  });

  it("starts_edits_from_the_existing_values", () => {
    render(
      <AssetForm
        action={vi.fn()}
        buildings={BUILDINGS}
        departmentSuggestions={["Physics"]}
        defaults={{
          name: "Laptop L-201",
          category: "Laptop",
          serialNumber: "DL-1",
          department: "Physics",
          buildingId: "b-vy",
          roomId: "r-vy001",
          purchaseDate: "2024-07-01",
          warrantyUntil: "",
          description: "",
        }}
        initialRooms={[
          { id: "r-vy001", room_number: "VY001", display_name: null },
        ]}
        today="2026-09-29"
        submitLabel="Save changes"
        cancelHref="/assets/AST-2026-00002"
      />,
    );
    expect(select("Category").value).toBe("Laptop");
    expect(select("Registered room").value).toBe("r-vy001");
    expect(screen.getByLabelText("Purchase date (optional)")).toHaveValue(
      "2024-07-01",
    );
  });
});

describe("AssetStatusControl", () => {
  function renderControl(
    status: Parameters<typeof AssetStatusControl>[0]["status"],
  ) {
    const action = vi.fn(async (): Promise<FormState> => ({ status: "idle" }));
    render(
      <ToastProvider>
        <AssetStatusControl status={status} action={action} />
      </ToastProvider>,
    );
    return action;
  }

  it("offers_only_the_allowed_transitions", () => {
    renderControl("LOST");
    const options = Array.from(select("Change status to").options).map(
      (o) => o.value,
    );
    expect(options).toEqual(["", "AVAILABLE", "RETIRED"]);
  });

  it("explains_why_assigned_assets_cannot_be_changed_here", () => {
    renderControl("ASSIGNED");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText(/assignment workflow/)).toBeInTheDocument();
  });

  it("asks_for_confirmation_before_retiring", async () => {
    const action = renderControl("DAMAGED");
    fireEvent.change(select("Change status to"), {
      target: { value: "RETIRED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Retire asset…" }));

    expect(action).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Retire this asset?" }),
    ).toHaveAttribute("open");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retire asset" }));
    });
    expect(action).toHaveBeenCalledOnce();
    const submitted = action.mock.calls[0] as unknown as [FormState, FormData];
    expect(submitted[1].get("status")).toBe("RETIRED");
  });

  it("does_not_submit_if_retirement_is_cancelled", () => {
    const action = renderControl("AVAILABLE");
    fireEvent.change(select("Change status to"), {
      target: { value: "RETIRED" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Retire asset…" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
  });
});
