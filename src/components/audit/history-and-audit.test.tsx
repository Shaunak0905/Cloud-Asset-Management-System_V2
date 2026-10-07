// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssetMaintenanceHistory } from "@/components/maintenance/asset-maintenance-history";
import {
  RequestProgress,
  requestSteps,
} from "@/components/maintenance/request-progress";
import type { AuditRow } from "@/lib/audit/format";

import { AuditLogTable } from "./audit-log-table";

const TECH = "11111111-1111-4111-8111-111111111111";

describe("AuditLogTable", () => {
  const rows: AuditRow[] = [
    {
      id: "a1",
      action: "MAINTENANCE_ASSIGNED",
      entity_type: "maintenance_request",
      entity_id: "req-1",
      old_values: { status: "OPEN", assigned_to: null },
      new_values: { status: "ASSIGNED", assigned_to: TECH },
      metadata: {
        request_number: "MR-2026-0017",
        asset_id: "AST-2026-00001",
        technician_id: TECH,
      },
      created_at: "2026-10-04T05:00:00Z",
      actor_id: "admin-1",
      actor: { full_name: "Asha Admin", email: "asha@campus.edu" },
    },
    {
      id: "a2",
      action: "ASSET_CREATED",
      entity_type: "asset",
      entity_id: "asset-1",
      old_values: null,
      new_values: { asset_id: "AST-2026-00002", name: "Projector" },
      metadata: null,
      created_at: "2026-10-04T04:00:00Z",
      actor_id: null,
      actor: null,
    },
  ];

  it("shows_who_did_what_to_which_record", () => {
    render(<AuditLogTable rows={rows} names={{ [TECH]: "Ravi Kumar" }} />);
    const [, first, second] = screen.getAllByRole("row");

    expect(first).toHaveTextContent("Asha Admin");
    expect(first).toHaveTextContent("Technician assigned");
    expect(
      within(first).getByRole("link", { name: "MR-2026-0017" }),
    ).toHaveAttribute("href", "/maintenance/MR-2026-0017");
    expect(first).toHaveTextContent("Status: Open → Assigned");
    expect(first).toHaveTextContent("Technician: — → Ravi Kumar");
    expect(within(first).getByText("Details")).toBeInTheDocument();
    // Internal ids are not shown.
    expect(first).not.toHaveTextContent(TECH);

    // Events without a signed-in actor (trusted maintenance) say so.
    expect(second).toHaveTextContent("System");
    expect(second).toHaveTextContent("Asset created");
    expect(second).toHaveTextContent("Name: Projector");
  });
});

describe("RequestProgress", () => {
  const base = {
    created_at: "2026-10-01T04:00:00Z",
    assigned_at: "2026-10-01T05:00:00Z",
    resolved_at: null,
    cancelled_at: null,
  };

  it("marks_the_steps_reached_with_their_times", () => {
    render(
      <RequestProgress
        steps={requestSteps({
          ...base,
          status: "IN_PROGRESS",
          startedAt: "2026-10-01T06:00:00Z",
        })}
      />,
    );
    const steps = screen.getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining("Reported (done)"),
      expect.stringContaining("Technician assigned (done)"),
      expect.stringContaining("In progress (done)"),
      "Resolved (not yet)",
    ]);
    expect(steps[2].querySelector("time")).not.toBeNull();
  });

  it("leaves_out_the_start_time_when_the_viewer_cannot_see_it", () => {
    const steps = requestSteps({ ...base, status: "IN_PROGRESS" });
    expect(steps[2]).toEqual({ label: "In progress", at: null, done: true });
  });

  it("ends_with_cancelled_for_a_cancelled_request", () => {
    expect(
      requestSteps({
        ...base,
        assigned_at: null,
        status: "CANCELLED",
        cancelled_at: "2026-10-02T04:00:00Z",
      }).map((step) => step.label),
    ).toEqual(["Reported", "Cancelled"]);
  });
});

describe("AssetMaintenanceHistory", () => {
  it("lists_each_problem_with_its_outcome", () => {
    render(
      <AssetMaintenanceHistory
        items={[
          {
            id: "m1",
            request_number: "MR-2026-0017",
            status: "RESOLVED",
            priority: "HIGH",
            description: "No image on screen",
            resolution_notes: "Replaced the HDMI board",
            created_at: "2026-10-01T04:00:00Z",
            resolved_at: "2026-10-02T04:00:00Z",
            cancelled_at: null,
          },
        ]}
      />,
    );
    const item = screen.getByRole("listitem");
    expect(
      within(item).getByRole("link", { name: "MR-2026-0017" }),
    ).toHaveAttribute("href", "/maintenance/MR-2026-0017");
    expect(item).toHaveTextContent("No image on screen");
    expect(item).toHaveTextContent("Done: Replaced the HDMI board");
    expect(item).toHaveTextContent("closed");
  });

  it("says_when_there_is_no_history", () => {
    render(<AssetMaintenanceHistory items={[]} />);
    expect(
      screen.getByText("No problems have been reported for this asset."),
    ).toBeInTheDocument();
  });
});
