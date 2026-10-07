// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

import { CancelRequestButton } from "./cancel-request-button";
import { ResolveForm } from "./resolve-form";

type AssetStatus = Parameters<typeof ResolveForm>[0]["assetStatus"];

function submittedData(action: ReturnType<typeof vi.fn>) {
  const [, data] = action.mock.calls[0] as unknown as [FormState, FormData];
  return data;
}

describe("ResolveForm", () => {
  function renderForm(
    assetStatus: AssetStatus,
    isAdmin: boolean,
    result: FormState = {
      status: "success",
      savedAt: 1,
      values: { assetStatus: "AVAILABLE" },
    },
  ) {
    const action = vi.fn(async (): Promise<FormState> => result);
    render(
      <ToastProvider>
        <ResolveForm
          action={action}
          assetStatus={assetStatus}
          isAdmin={isAdmin}
        />
      </ToastProvider>,
    );
    return action;
  }

  const notes = () =>
    screen.getByLabelText("What was done?") as HTMLTextAreaElement;
  const submit = () => screen.getByRole("button", { name: "Resolve request" });

  it("needs_a_final_state_then_submits_it_with_the_notes", async () => {
    const action = renderForm("IN_MAINTENANCE", false);
    expect(submit()).toBeDisabled();

    fireEvent.change(notes(), { target: { value: "Replaced the lamp" } });
    fireEvent.click(screen.getByRole("radio", { name: /^Repaired/ }));
    await act(async () => {
      fireEvent.click(submit());
    });

    const data = submittedData(action);
    expect(data.get("resolutionNotes")).toBe("Replaced the lamp");
    expect(data.get("assetStatus")).toBe("AVAILABLE");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Request resolved. The asset is back in service.",
    );
  });

  it("offers_retirement_to_admins_only", () => {
    renderForm("IN_MAINTENANCE", false);
    expect(screen.queryByRole("radio", { name: /^Beyond repair/ })).toBeNull();
  });

  it("asks_before_retiring_the_asset", async () => {
    const action = renderForm("DAMAGED", true, {
      status: "success",
      savedAt: 1,
      values: { assetStatus: "RETIRED" },
    });
    fireEvent.change(notes(), { target: { value: "Board burnt out" } });
    fireEvent.click(screen.getByRole("radio", { name: /^Beyond repair/ }));
    fireEvent.click(submit());
    expect(action).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", { name: "Retire this asset?" });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Resolve and retire" }),
      );
    });
    expect(submittedData(action).get("assetStatus")).toBe("RETIRED");
    expect(screen.getByRole("status")).toHaveTextContent(
      "The asset has been retired.",
    );
  });

  it("explains_why_an_asset_in_use_keeps_its_status", async () => {
    const action = renderForm("ASSIGNED", true, {
      status: "success",
      savedAt: 1,
      values: { assetStatus: "ASSIGNED" },
    });
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByText(/stays with them/)).toBeInTheDocument();

    fireEvent.change(notes(), { target: { value: "Fixed on site" } });
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(submittedData(action).get("assetStatus")).toBeNull();
  });

  it("keeps_what_was_typed_when_the_database_refuses", async () => {
    renderForm("IN_MAINTENANCE", false, {
      status: "error",
      message: "Start work before resolving the request.",
    });
    fireEvent.change(notes(), { target: { value: "Replaced the lamp" } });
    fireEvent.click(screen.getByRole("radio", { name: /^Still damaged/ }));
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Start work before resolving",
    );
    expect(notes().value).toBe("Replaced the lamp");
    expect(
      (
        screen.getByRole("radio", {
          name: /^Still damaged/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });
});

describe("CancelRequestButton", () => {
  function renderButton(
    result: FormState,
    assetStatus: AssetStatus = "IN_MAINTENANCE",
  ) {
    const action = vi.fn(async (): Promise<FormState> => result);
    render(
      <ToastProvider>
        <CancelRequestButton action={action} assetStatus={assetStatus} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel this request?" });
    return { action, dialog };
  }

  it("cancels_with_a_reason_and_says_when_the_asset_is_released", async () => {
    const { action, dialog } = renderButton({
      status: "success",
      savedAt: 1,
      values: { assetStatus: "AVAILABLE" },
    });
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Duplicate of MR-2026-0001" },
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Cancel request" }),
      );
    });
    expect(submittedData(action).get("reason")).toBe(
      "Duplicate of MR-2026-0001",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Request cancelled. The asset is available again.",
    );
  });

  it("does_nothing_when_the_request_is_kept", () => {
    const { action, dialog } = renderButton({ status: "success" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Keep request" }),
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("shows_why_a_cancellation_was_refused", async () => {
    const { dialog } = renderButton({
      status: "error",
      fieldErrors: { reason: ["Say why the request is being cancelled."] },
    });
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Cancel request" }),
      );
    });
    expect(within(dialog).getByLabelText("Reason")).toHaveAccessibleDescription(
      "Say why the request is being cancelled.",
    );
  });
});
