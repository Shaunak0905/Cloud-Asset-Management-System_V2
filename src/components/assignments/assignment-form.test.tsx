// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/forms";

import { AssignmentForm } from "./assignment-form";

vi.mock("@/lib/locations/rooms-client", () => ({
  fetchActiveRooms: vi.fn(async () => [
    { id: "r-vk404", room_number: "VK404", display_name: "Classroom 404" },
  ]),
}));

function select(name: string) {
  return screen.getByRole("combobox", { name }) as HTMLSelectElement;
}

describe("AssignmentForm", () => {
  it("submits_the_usage_location_and_keeps_it_after_an_error", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({
      status: "error",
      message: "This asset is no longer available.",
    }));
    render(
      <AssignmentForm
        action={action}
        buildings={[{ id: "b-vk", name: "Vivekananda", code: "VK" }]}
        minReturn="2026-09-29T12:00"
        cancelHref="/assets/AST-2026-00001"
      />,
    );

    await act(async () => {
      fireEvent.change(select("Building"), { target: { value: "b-vk" } });
    });
    fireEvent.change(select("Room"), { target: { value: "r-vk404" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Submit request" }));
    });

    const [, submitted] = action.mock.calls[0] as unknown as [
      FormState,
      FormData,
    ];
    expect(submitted.get("buildingId")).toBe("b-vk");
    expect(submitted.get("roomId")).toBe("r-vk404");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This asset is no longer available.",
    );
    expect(select("Building").value).toBe("b-vk");
    expect(select("Room").value).toBe("r-vk404");
  });

  it("limits_the_return_picker_to_the_future", () => {
    render(
      <AssignmentForm
        action={vi.fn()}
        buildings={[]}
        minReturn="2026-09-29T12:00"
        cancelHref="/assets/AST-2026-00001"
      />,
    );
    expect(screen.getByLabelText("Expected return")).toHaveAttribute(
      "min",
      "2026-09-29T12:00",
    );
  });
});

describe("AssignmentForm for admins", () => {
  it("asks_who_receives_the_asset_and_keeps_it_after_an_error", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({
      status: "error",
      fieldErrors: { userEmail: ["No user has this email address."] },
    }));
    render(
      <AssignmentForm
        action={action}
        buildings={[{ id: "b-vk", name: "Vivekananda", code: "VK" }]}
        minReturn="2026-09-29T12:00"
        cancelHref="/assets/AST-2026-00001"
        withRecipient
        submitLabel="Transfer asset"
      />,
    );

    const email = screen.getByLabelText("Assign to") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "priya@example.edu" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Transfer asset" }));
    });

    const [, submitted] = action.mock.calls[0] as unknown as [
      FormState,
      FormData,
    ];
    expect(submitted.get("userEmail")).toBe("priya@example.edu");
    expect(email).toHaveAccessibleDescription(
      expect.stringContaining("No user has this email address."),
    );
    expect(email.value).toBe("priya@example.edu");
  });

  it("does_not_ask_for_a_recipient_when_requesting_for_yourself", () => {
    render(
      <AssignmentForm
        action={vi.fn()}
        buildings={[]}
        minReturn="2026-09-29T12:00"
        cancelHref="/assets/AST-2026-00001"
      />,
    );
    expect(screen.queryByLabelText("Assign to")).not.toBeInTheDocument();
  });
});
