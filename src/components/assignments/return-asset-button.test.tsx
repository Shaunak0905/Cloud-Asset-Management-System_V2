// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

import { ReturnAssetButton } from "./return-asset-button";

function renderButton(result: FormState, onBehalfOf?: string) {
  const action = vi.fn(async () => result);
  render(
    <ToastProvider>
      <ReturnAssetButton
        action={action}
        assetName="Epson Projector P-104"
        onBehalfOf={onBehalfOf}
      />
    </ToastProvider>,
  );
  const open = () =>
    fireEvent.click(screen.getAllByRole("button", { name: "Return asset" })[0]);
  const confirm = () =>
    act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Return asset",
        }),
      );
    });
  return { action, open, confirm };
}

describe("ReturnAssetButton", () => {
  it("asks_for_confirmation_before_returning", async () => {
    const { action, open, confirm } = renderButton({
      status: "success",
      savedAt: 1,
    });
    open();
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Epson Projector P-104 will become available to others.",
    );

    await confirm();
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Asset returned. It is available again.",
    );
  });

  it("does_nothing_if_cancelled", () => {
    const { action, open } = renderButton({ status: "success" });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("shows_the_reason_when_the_return_is_refused", async () => {
    const { open, confirm } = renderButton({
      status: "error",
      message: "This asset has already been returned.",
    });
    open();
    await confirm();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This asset has already been returned.",
    );
  });

  it("names_the_holder_when_an_admin_returns_it_for_them", () => {
    const { open } = renderButton({ status: "success" }, "Priya Sharma");
    open();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "This ends Priya Sharma's use of Epson Projector P-104",
    );
  });
});
