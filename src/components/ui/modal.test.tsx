// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Modal } from "./modal";

function renderModal(props: { dismissible?: boolean } = {}) {
  const onClose = vi.fn();
  render(
    <Modal open title="Edit room VY001" onClose={onClose} {...props}>
      <button type="button">Inside</button>
    </Modal>,
  );
  return {
    onClose,
    dialog: screen.getByRole("dialog", { name: "Edit room VY001" }),
  };
}

describe("Modal", () => {
  it("opens_as_a_labelled_dialog", () => {
    const { dialog } = renderModal();
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Inside" })).toBeInTheDocument();
  });

  it("closes_on_escape_and_on_backdrop_click", () => {
    const { onClose, dialog } = renderModal();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("ignores_clicks_inside_the_content", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays_open_when_not_dismissible", () => {
    const { onClose, dialog } = renderModal({ dismissible: false });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });
});
