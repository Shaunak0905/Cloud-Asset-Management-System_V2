import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Runs for every test file; DOM-specific parts only apply under jsdom.

if (typeof HTMLDialogElement !== "undefined") {
  // jsdom supports the `open` attribute but not modal methods. Emulate the
  // behaviour our components rely on: open/close state and the "close" event.
  const proto = HTMLDialogElement.prototype;
  proto.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close ??= function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
