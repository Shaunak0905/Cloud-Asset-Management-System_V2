// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";

import { FlashToast } from "./flash-toast";

let search = "";
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/admin/buildings/abc",
  useRouter: () => ({ replace }),
}));

function renderFlash() {
  render(
    <ToastProvider>
      <FlashToast />
    </ToastProvider>,
  );
}

beforeEach(() => {
  replace.mockClear();
});

describe("FlashToast", () => {
  it("shows_a_known_message_once_and_removes_the_parameter", () => {
    search = "toast=building-created&tab=rooms";
    renderFlash();
    expect(screen.getByRole("status")).toHaveTextContent("Building created.");
    expect(replace).toHaveBeenCalledWith("/admin/buildings/abc?tab=rooms", {
      scroll: false,
    });
  });

  it("never_displays_text_from_an_unknown_code", () => {
    search = "toast=%3Cb%3EYou%20won%3C%2Fb%3E";
    renderFlash();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/admin/buildings/abc", {
      scroll: false,
    });
  });

  it("does_nothing_without_the_parameter", () => {
    search = "";
    renderFlash();
    expect(replace).not.toHaveBeenCalled();
  });
});
