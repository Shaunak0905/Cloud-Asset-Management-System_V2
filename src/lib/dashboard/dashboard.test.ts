import { describe, expect, it } from "vitest";

import { campusMonthStart } from "@/lib/format";

import {
  myDashboardSchema,
  parseAdminDashboard,
  repairRate,
  sustainabilitySchema,
  technicianDashboardSchema,
  withZeros,
} from "./schema";

const ADMIN_RESULT = {
  assets_by_status: { AVAILABLE: 9, ASSIGNED: 3, RETIRED: 1 },
  maintenance_by_status: { OPEN: 2, RESOLVED: 4 },
  open_by_priority: { CRITICAL: 1 },
  unassigned_serious: 1,
  resolved_this_month: 3,
  active_assignments: 3,
  overdue_assignments: 1,
  assets_by_category: [{ key: "Projector", label: "Projector", count: 5 }],
  assets_by_building: [{ key: "b1", label: "Vyas", count: 7 }],
  technicians: [
    {
      id: "t1",
      name: "Ravi",
      assigned: 1,
      in_progress: 0,
      resolved_this_month: 2,
    },
  ],
};

describe("admin dashboard result", () => {
  it("fills_statuses_with_no_rows_as_zero_and_totals_the_assets", () => {
    const dashboard = parseAdminDashboard(ADMIN_RESULT);
    expect(dashboard.assets_by_status).toEqual({
      AVAILABLE: 9,
      ASSIGNED: 3,
      IN_MAINTENANCE: 0,
      LOST: 0,
      DAMAGED: 0,
      RETIRED: 1,
    });
    expect(dashboard.total_assets).toBe(13);
    expect(dashboard.maintenance_by_status.IN_PROGRESS).toBe(0);
    expect(dashboard.open_by_priority).toEqual({
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 1,
    });
  });

  it("refuses_a_result_with_the_wrong_shape_instead_of_showing_bad_numbers", () => {
    expect(() =>
      parseAdminDashboard({ ...ADMIN_RESULT, overdue_assignments: "1" }),
    ).toThrow();
    expect(() =>
      parseAdminDashboard({
        ...ADMIN_RESULT,
        assets_by_status: { MISSING: 2 },
      }),
    ).toThrow();
    expect(() =>
      parseAdminDashboard({ ...ADMIN_RESULT, resolved_this_month: -1 }),
    ).toThrow();
  });
});

describe("technician and user dashboard results", () => {
  it("parse_the_counts", () => {
    expect(
      technicianDashboardSchema.parse({
        assigned: 1,
        in_progress: 2,
        serious: 1,
        resolved_this_month: 0,
      }),
    ).toMatchObject({ in_progress: 2 });
    expect(() =>
      myDashboardSchema.parse({ active_assignments: 1, open_reports: 0 }),
    ).toThrow();
  });
});

describe("withZeros", () => {
  it("keeps_only_the_known_keys", () => {
    expect(withZeros({ a: 2 }, ["a", "b"] as const)).toEqual({ a: 2, b: 0 });
  });
});

describe("campusMonthStart", () => {
  it("is_midnight_on_the_first_in_campus_time", () => {
    // 1 Oct 2026, 01:00 IST is still 30 Sep in UTC.
    expect(campusMonthStart(new Date("2026-09-30T19:30:00Z"))).toBe(
      "2026-09-30T18:30:00.000Z",
    );
    expect(campusMonthStart(new Date("2026-10-31T12:00:00Z"))).toBe(
      "2026-09-30T18:30:00.000Z",
    );
  });
});

describe("sustainability figures", () => {
  it("parse_the_database_result", () => {
    const result = {
      repairs: { repaired: 6, still_damaged: 1, retired: 1 },
      sharing: { loans: 40, assets_shared: 12 },
      warranty: { reported_under_warranty: 3, open_under_warranty: 1 },
    };
    expect(sustainabilitySchema.parse(result)).toEqual(result);
    expect(() =>
      sustainabilitySchema.parse({ ...result, sharing: { loans: -1 } }),
    ).toThrow();
  });

  it("give_the_repair_rate_as_a_whole_percentage", () => {
    expect(repairRate({ repaired: 6, still_damaged: 1, retired: 1 })).toBe(75);
    expect(repairRate({ repaired: 2, still_damaged: 1, retired: 0 })).toBe(67);
    expect(repairRate({ repaired: 0, still_damaged: 0, retired: 0 })).toBe(
      null,
    );
  });
});
