import { describe, expect, it } from "vitest";

import { campusDayRange } from "@/lib/format";

import { auditActionLabel } from "./events";
import {
  auditChanges,
  auditDetails,
  auditReference,
  type AuditRow,
  mentionedProfileIds,
} from "./format";
import {
  auditListQuery,
  hasAuditFilters,
  normalizeActorSearch,
  parseAuditListParams,
  referenceKind,
} from "./schema";

const TECH = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

function row(overrides: Partial<AuditRow>): AuditRow {
  return {
    id: "row-1",
    action: "ASSET_STATUS_CHANGED",
    entity_type: "asset",
    entity_id: "33333333-3333-4333-8333-333333333333",
    old_values: null,
    new_values: null,
    metadata: null,
    created_at: "2026-10-04T05:00:00Z",
    actor_id: USER,
    actor: { full_name: "Admin", email: "admin@campus.edu" },
    ...overrides,
  };
}

describe("audit filters", () => {
  it("keep_valid_values_and_drop_the_rest", () => {
    expect(
      parseAuditListParams({
        action: "MAINTENANCE_RESOLVED",
        entity: "maintenance_request",
        actor: " ravi@campus.edu ",
        reference: "mr-2026-0017",
        from: "2026-10-01",
        to: "2026-10-04",
        page: "3",
      }),
    ).toEqual({
      action: "MAINTENANCE_RESOLVED",
      entityType: "maintenance_request",
      actor: "ravi@campus.edu",
      reference: "MR-2026-0017",
      from: "2026-10-01",
      to: "2026-10-04",
      page: 3,
    });

    expect(
      parseAuditListParams({
        action: "DROP_TABLE",
        entity: "secrets",
        reference: "AST-1",
        from: "2026-02-30",
        to: "yesterday",
        page: "-1",
      }),
    ).toEqual({
      action: null,
      entityType: null,
      actor: null,
      reference: null,
      from: null,
      to: null,
      page: 1,
    });
  });

  it("swap_a_reversed_date_range", () => {
    const params = parseAuditListParams({
      from: "2026-10-04",
      to: "2026-10-01",
    });
    expect([params.from, params.to]).toEqual(["2026-10-01", "2026-10-04"]);
  });

  it("make_actor_searches_safe_for_a_quoted_filter", () => {
    expect(normalizeActorSearch('ravi"),(role.eq.ADMIN')).toBe(
      "ravi role.eq.ADMIN",
    );
    expect(normalizeActorSearch("priya.shah+lab@campus.edu")).toBe(
      "priya.shah+lab@campus.edu",
    );
    expect(normalizeActorSearch("  ")).toBeNull();
  });

  it("recognise_asset_ids_and_request_numbers", () => {
    expect(referenceKind("AST-2026-00001")).toBe("asset");
    expect(referenceKind("MR-2026-0017")).toBe("request");
    expect(referenceKind("AST-2026-1")).toBeNull();
    expect(referenceKind("anything")).toBeNull();
  });

  it("round_trip_through_the_url", () => {
    const params = parseAuditListParams({
      action: "ROLE_CHANGED",
      actor: "admin",
      page: "2",
    });
    expect(auditListQuery(params)).toBe(
      "?action=ROLE_CHANGED&actor=admin&page=2",
    );
    expect(auditListQuery({ ...params, page: 1 })).toBe(
      "?action=ROLE_CHANGED&actor=admin",
    );
    expect(hasAuditFilters(params)).toBe(true);
    expect(hasAuditFilters(parseAuditListParams({ page: "4" }))).toBe(false);
  });

  it("turn_campus_days_into_a_utc_range", () => {
    // Campus time is IST (UTC+05:30); "to" includes the whole day.
    expect(campusDayRange({ from: "2026-10-01", to: "2026-10-04" })).toEqual({
      since: "2026-09-30T18:30:00.000Z",
      before: "2026-10-04T18:30:00.000Z",
    });
    expect(campusDayRange({ from: null, to: "2026-12-31" })).toEqual({
      since: null,
      before: "2026-12-31T18:30:00.000Z",
    });
  });
});

describe("audit display", () => {
  it("labels_known_actions_and_shows_unknown_ones_as_they_are", () => {
    expect(auditActionLabel("MAINTENANCE_HISTORY_ADDED")).toBe(
      "Work note added",
    );
    expect(auditActionLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });

  it("links_to_the_record_an_event_is_about", () => {
    const names = { [USER]: "Priya Shah" };
    expect(
      auditReference(row({ metadata: { asset_id: "AST-2026-00001" } }), names),
    ).toEqual({ label: "AST-2026-00001", href: "/assets/AST-2026-00001" });
    expect(
      auditReference(
        row({
          action: "ASSET_CREATED",
          new_values: { asset_id: "AST-2026-00009" },
        }),
        names,
      ),
    ).toEqual({ label: "AST-2026-00009", href: "/assets/AST-2026-00009" });
    expect(
      auditReference(
        row({
          entity_type: "maintenance_request",
          metadata: { request_number: "MR-2026-0017" },
        }),
        names,
      ),
    ).toEqual({ label: "MR-2026-0017", href: "/maintenance/MR-2026-0017" });
    expect(
      auditReference(
        row({
          entity_type: "asset_document",
          metadata: {
            request_number: "MR-2026-0017",
            document_type: "RECEIPT",
          },
        }),
        names,
      ),
    ).toEqual({
      label: "File · MR-2026-0017",
      href: "/maintenance/MR-2026-0017",
    });
    expect(
      auditReference(row({ entity_type: "profile", entity_id: USER }), names),
    ).toEqual({ label: "Priya Shah", href: null });
  });

  it("describes_changes_in_words", () => {
    expect(
      auditChanges(
        row({
          old_values: { status: "AVAILABLE" },
          new_values: { status: "IN_MAINTENANCE" },
        }),
        {},
      ),
    ).toEqual([{ field: "Status", from: "Available", to: "In maintenance" }]);

    expect(
      auditChanges(
        row({
          entity_type: "maintenance_request",
          old_values: { status: "OPEN", assigned_to: null },
          new_values: { status: "ASSIGNED", assigned_to: TECH },
        }),
        { [TECH]: "Ravi Kumar" },
      ),
    ).toEqual([
      { field: "Status", from: "Open", to: "Assigned" },
      { field: "Technician", from: "—", to: "Ravi Kumar" },
    ]);

    expect(
      auditChanges(
        row({
          entity_type: "profile",
          old_values: { role: "STUDENT" },
          new_values: { role: "TECHNICIAN" },
        }),
        {},
      ),
    ).toEqual([{ field: "Role", from: "Student", to: "Technician" }]);
  });

  it("shows_a_home_location_change_as_one_line", () => {
    expect(
      auditChanges(
        row({
          action: "ASSET_REGISTERED_LOCATION_CHANGED",
          old_values: {
            building_id: "b1",
            building: "VY",
            room_id: "r1",
            room: "VY001",
          },
          new_values: {
            building_id: "b2",
            building: "VK",
            room_id: "r2",
            room: "VK404",
          },
        }),
        {},
      ),
    ).toEqual([{ field: "Location", from: "VY / VY001", to: "VK / VK404" }]);
  });

  it("lists_useful_details_and_hides_internal_ids", () => {
    const details = auditDetails(
      row({
        action: "ASSET_UPDATED",
        metadata: {
          asset_id: "AST-2026-00001",
          changed_fields: ["name", "warranty_until"],
          document_id: "4444",
          final_asset_status: "DAMAGED",
          history_type: "PART_REPLACEMENT",
        },
      }),
      {},
    );
    expect(details).toEqual([
      { label: "Changed", value: "name, warranty" },
      { label: "Asset now", value: "Damaged" },
      { label: "Entry", value: "Part replaced" },
    ]);
  });

  it("collects_the_people_mentioned_in_events", () => {
    expect(
      mentionedProfileIds([
        row({ entity_type: "profile", entity_id: USER }),
        row({ new_values: { assigned_to: TECH } }),
        row({ metadata: { technician_id: TECH } }),
      ]).sort(),
    ).toEqual([TECH, USER].sort());
  });
});
