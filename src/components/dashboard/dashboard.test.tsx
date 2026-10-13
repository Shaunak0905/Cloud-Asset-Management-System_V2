// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActiveAssignmentsList } from "./active-assignments-list";
import { DistributionList } from "./distribution-list";
import { RecentActivity } from "./recent-activity";
import { StatCard } from "./stat-card";
import { SustainabilitySummary } from "./sustainability-summary";
import { TechnicianWorkload } from "./technician-workload";

describe("StatCard", () => {
  it("says_what_it_counts_and_links_to_the_list", () => {
    render(
      <StatCard
        label="In maintenance"
        value={4}
        href="/admin/assets?status=IN_MAINTENANCE"
      />,
    );
    const link = screen.getByRole("link", { name: /In maintenance\s*4/ });
    expect(link).toHaveAttribute("href", "/admin/assets?status=IN_MAINTENANCE");
  });

  it("highlights_only_numbers_above_zero", () => {
    const { rerender } = render(
      <StatCard label="Overdue returns" value={2} tone="danger" />,
    );
    expect(screen.getByText("2")).toHaveClass("text-red-700");
    expect(screen.queryByRole("link")).toBeNull();

    rerender(<StatCard label="Overdue returns" value={0} tone="danger" />);
    expect(screen.getByText("0")).toHaveClass("text-slate-900");
  });
});

describe("DistributionList", () => {
  it("writes_every_number_out_next_to_its_bar", () => {
    render(
      <DistributionList
        label="Assets by building"
        emptyText="No assets yet."
        items={[
          {
            key: "b1",
            label: "Vyas",
            count: 8,
            href: "/admin/assets?building=b1",
          },
          { key: "b2", label: "Vivekananda", count: 2 },
        ]}
      />,
    );
    const [first, second] = screen.getAllByRole("listitem");
    expect(first).toHaveTextContent("Vyas8");
    expect(within(first).getByRole("link", { name: "Vyas" })).toHaveAttribute(
      "href",
      "/admin/assets?building=b1",
    );
    expect(second).toHaveTextContent("Vivekananda2");
    // The largest bar is full width; others are in proportion.
    const bars = document.querySelectorAll<HTMLElement>("[aria-hidden] > div");
    expect([...bars].map((bar) => bar.style.width)).toEqual(["100%", "25%"]);
  });

  it("explains_an_empty_list", () => {
    render(
      <DistributionList label="x" emptyText="No assets yet." items={[]} />,
    );
    expect(screen.getByText("No assets yet.")).toBeInTheDocument();
  });
});

describe("ActiveAssignmentsList", () => {
  const item = {
    id: "a1",
    expected_return_at: "2026-10-01T10:00:00Z",
    assets: { asset_id: "AST-2026-00001", name: "Epson Projector P-104" },
    buildings: { name: "Vivekananda" },
    rooms: { room_number: "VK404" },
    profiles: { full_name: "Asha Rao", email: "asha@campus.edu" },
  };

  it("shows_where_the_asset_is_being_used_and_flags_overdue_returns", () => {
    render(
      <ActiveAssignmentsList
        items={[item, { ...item, id: "a2", expected_return_at: null }]}
        now={new Date("2026-10-05T00:00:00Z")}
      />,
    );
    const [overdue, open] = screen.getAllByRole("listitem");
    expect(overdue).toHaveTextContent("Vivekananda / VK404");
    expect(overdue).toHaveTextContent("Overdue");
    expect(overdue).not.toHaveTextContent("Asha Rao");
    expect(open).toHaveTextContent("No return time set");
    expect(open).not.toHaveTextContent("Overdue");
  });

  it("names_the_holder_for_admins", () => {
    render(<ActiveAssignmentsList items={[item]} showHolder />);
    expect(screen.getByRole("listitem")).toHaveTextContent("Asha Rao");
  });
});

describe("TechnicianWorkload", () => {
  it("lists_each_technicians_work", () => {
    render(
      <TechnicianWorkload
        rows={[
          {
            id: "t1",
            name: "Ravi Kumar",
            assigned: 2,
            in_progress: 1,
            resolved_this_month: 5,
          },
        ]}
      />,
    );
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Ravi Kumar2 assigned1 in progress5 resolved this month",
    );
  });

  it("explains_when_there_are_no_technicians", () => {
    render(<TechnicianWorkload rows={[]} />);
    expect(screen.getByText(/no active technicians/)).toBeInTheDocument();
  });
});

describe("RecentActivity", () => {
  it("summarises_each_event_in_one_line", () => {
    render(
      <RecentActivity
        names={{}}
        rows={[
          {
            id: "e1",
            action: "MAINTENANCE_RESOLVED",
            entity_type: "maintenance_request",
            entity_id: "r1",
            old_values: null,
            new_values: null,
            metadata: { request_number: "MR-2026-0017" },
            created_at: "2026-10-05T05:00:00Z",
            actor_id: "t1",
            actor: { full_name: "Ravi Kumar", email: null },
          },
        ]}
      />,
    );
    const event = screen.getByRole("listitem");
    expect(event).toHaveTextContent(
      "Ravi Kumar · Request resolved · MR-2026-0017",
    );
    expect(within(event).getByRole("link")).toHaveAttribute(
      "href",
      "/maintenance/MR-2026-0017",
    );
  });
});

describe("SustainabilitySummary", () => {
  it("shows_the_repair_rate_sharing_and_warranty_figures", () => {
    render(
      <SustainabilitySummary
        data={{
          repairs: { repaired: 6, still_damaged: 1, retired: 1 },
          sharing: { loans: 40, assets_shared: 1 },
          warranty: { reported_under_warranty: 3, open_under_warranty: 2 },
        }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Sustainability" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/SDG 12/)).toBeInTheDocument();
    const rate = screen.getByRole("link", {
      name: /Repaired instead of replaced\s*75%/,
    });
    expect(rate).toHaveAttribute("href", "/admin/maintenance?status=RESOLVED");
    expect(rate).toHaveTextContent(
      "6 back in service · 1 still damaged · 1 retired",
    );
    const cards = within(
      screen.getByRole("region", { name: "Sustainability" }),
    );
    expect(cards.getByText("40")).toBeInTheDocument();
    expect(
      cards.getByText("1 asset used by more than one person"),
    ).toBeInTheDocument();
    expect(cards.getByText("2")).toHaveClass("text-amber-700");
  });

  it("shows_a_dash_before_any_repair_is_finished", () => {
    render(
      <SustainabilitySummary
        data={{
          repairs: { repaired: 0, still_damaged: 0, retired: 0 },
          sharing: { loans: 0, assets_shared: 0 },
          warranty: { reported_under_warranty: 0, open_under_warranty: 0 },
        }}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Repaired instead of replaced\s*—/ }),
    ).toHaveTextContent("No repairs finished yet");
  });

  it("says_when_the_figures_cannot_be_loaded", () => {
    render(<SustainabilitySummary data={null} />);
    expect(
      screen.getByText("Sustainability figures are unavailable right now."),
    ).toBeInTheDocument();
  });
});
