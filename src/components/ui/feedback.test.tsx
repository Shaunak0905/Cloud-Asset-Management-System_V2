// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppError from "@/app/(app)/error";

import { ConfirmDialog } from "./confirm-dialog";
import { TOAST_DURATION_MS, ToastProvider, useToast } from "./toast";

describe("ConfirmDialog", () => {
  function renderDialog(
    props: Partial<Parameters<typeof ConfirmDialog>[0]> = {},
  ) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const view = render(
      <ConfirmDialog
        open
        title="Retire this asset?"
        description="This will prevent future assignments."
        confirmLabel="Retire asset"
        tone="danger"
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />,
    );
    return { ...view, onConfirm, onCancel };
  }

  it("is_an_accessible_modal_with_title_and_consequence", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Retire this asset?" });
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAccessibleDescription(
      "This will prevent future assignments.",
    );
  });

  it("calls_onConfirm_and_onCancel", () => {
    const { onConfirm, onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Retire asset" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables_both_buttons_while_pending", () => {
    renderDialog({ pending: true });
    expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("closes_when_open_becomes_false", () => {
    const { rerender, onConfirm, onCancel } = renderDialog();
    rerender(
      <ConfirmDialog
        open={false}
        title="Retire this asset?"
        description="x"
        confirmLabel="Retire asset"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(document.querySelector("dialog")).not.toHaveAttribute("open");
  });
});

describe("Toasts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function Trigger() {
    const toast = useToast();
    return (
      <button
        type="button"
        onClick={() => toast({ tone: "success", title: "Profile updated" })}
      >
        Save
      </button>
    );
  }

  it("shows_a_status_message_that_can_be_dismissed", () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Profile updated");

    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(screen.queryByText("Profile updated")).not.toBeInTheDocument();
  });

  it("dismisses_itself_after_a_few_seconds", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Profile updated")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText("Profile updated")).not.toBeInTheDocument();
  });

  it("requires_a_provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(
      "useToast must be used inside <ToastProvider>",
    );
  });
});

describe("signed-in error page", () => {
  it("explains_the_problem_without_details_and_offers_a_retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(
      <AppError
        error={Object.assign(new Error("relation does not exist"), {
          digest: "123",
        })}
        retry={retry}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("This page could not be loaded");
    expect(alert).not.toHaveTextContent("relation does not exist");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("link", { name: "Go to my home page" }),
    ).toHaveAttribute("href", "/login");
  });
});
