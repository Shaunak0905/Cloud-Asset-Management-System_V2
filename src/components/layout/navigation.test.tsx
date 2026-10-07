// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/lib/auth/types";

import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
// The sign-out Server Action pulls in server-only modules.
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

const student: CurrentUser = {
  id: "u1",
  email: "student@campus.edu",
  fullName: "Asha Student",
  role: "STUDENT",
  department: null,
};

beforeEach(() => {
  pathname = "/";
});

describe("SidebarNav", () => {
  it("marks_the_current_section_as_the_current_page", () => {
    pathname = "/admin/assets/123";
    render(<SidebarNav role="ADMIN" />);

    expect(screen.getByRole("link", { name: "Assets" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("shows_students_no_admin_or_technician_links", () => {
    render(<SidebarNav role="STUDENT" />);
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));

    expect(hrefs).toEqual([
      "/dashboard",
      "/assets",
      "/assignments",
      "/maintenance",
      "/notifications",
      "/profile",
    ]);
  });

  it("calls_onNavigate_when_a_link_is_chosen", () => {
    const onNavigate = vi.fn();
    render(<SidebarNav role="TECHNICIAN" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("link", { name: "My Maintenance" }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});

describe("MobileNav", () => {
  function drawer() {
    return document.getElementById("mobile-navigation") as HTMLDialogElement;
  }

  it("opens_the_drawer_and_closes_it_after_navigating", () => {
    render(<MobileNav user={student} home="/dashboard" />);
    const menuButton = screen.getByRole("button", { name: "Open navigation" });
    expect(drawer().open).toBe(false);
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);
    expect(drawer().open).toBe(true);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(
      within(drawer()).getByRole("link", { name: "My Requests" }),
    );
    expect(drawer().open).toBe(false);
  });

  it("closes_with_the_close_button", () => {
    render(<MobileNav user={student} home="/dashboard" />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(drawer().open).toBe(false);
  });

  it("shows_who_is_signed_in", () => {
    render(<MobileNav user={student} home="/dashboard" />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(within(drawer()).getByText("Asha Student")).toBeInTheDocument();
    expect(within(drawer()).getByText("Student")).toBeInTheDocument();
  });
});
