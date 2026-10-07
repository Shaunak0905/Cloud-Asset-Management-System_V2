// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";

import { MarkAllReadButton } from "./mark-all-read-button";
import { NotificationList } from "./notification-list";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
// The sign-out Server Action in the mobile drawer pulls in server-only modules.
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

const items = [
  {
    id: "n1",
    type: "ASSIGNMENT_OVERDUE",
    title: "Overdue: Epson Projector P-104",
    message: "It was due back on 3 Oct 2026.",
    link: "/assets/AST-2026-00001",
    is_read: false,
    created_at: "2026-10-05T01:30:00Z",
  },
  {
    id: "n2",
    type: "WARRANTY_EXPIRING",
    title: "Warranty ending soon: Laptop",
    message: "The warranty ends on 20 Oct 2026.",
    link: "/assets/AST-2026-00002",
    is_read: true,
    created_at: "2026-10-04T01:30:00Z",
  },
];

describe("NotificationList", () => {
  it("marks_unread_notifications_and_opens_each_through_its_action", () => {
    const openAction = vi.fn((id: string) => async () => {
      void id;
    });
    render(<NotificationList items={items} openAction={openAction} />);

    const [unread, read] = screen.getAllByRole("button");
    expect(unread).toHaveAccessibleName(
      /^Unread\.\s*Overdue: Epson Projector P-104/,
    );
    expect(read).toHaveAccessibleName(/^Warranty ending soon: Laptop/);
    expect(openAction).toHaveBeenCalledWith("n1");
    expect(openAction).toHaveBeenCalledWith("n2");
  });
});

describe("MarkAllReadButton", () => {
  it("marks_everything_read_and_confirms", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({
      status: "success",
      savedAt: 1,
    }));
    render(
      <ToastProvider>
        <MarkAllReadButton action={action} />
      </ToastProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    });
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent(
      "All notifications marked as read.",
    );
  });
});

describe("unread badge", () => {
  it("shows_the_count_on_the_notifications_link", () => {
    render(<SidebarNav role="STUDENT" badges={{ "/notifications": 3 }} />);
    expect(
      screen.getByRole("link", { name: "Notifications, 3 unread" }),
    ).toBeInTheDocument();
  });

  it("shows_nothing_when_everything_is_read", () => {
    render(<SidebarNav role="STUDENT" badges={{ "/notifications": 0 }} />);
    expect(
      screen.getByRole("link", { name: "Notifications" }),
    ).toBeInTheDocument();
  });

  it("puts_a_bell_with_the_count_in_the_mobile_top_bar", () => {
    render(
      <MobileNav
        user={{
          id: "u1",
          email: "a@campus.edu",
          fullName: "Asha",
          role: "STUDENT",
          department: null,
        }}
        home="/dashboard"
        unreadNotifications={2}
      />,
    );
    const bell = screen.getAllByRole("link", {
      name: /Notifications \(2 unread\)/,
    });
    expect(bell[0]).toHaveAttribute("href", "/notifications");
    expect(within(bell[0]).getByText("2")).toBeInTheDocument();
  });
});
