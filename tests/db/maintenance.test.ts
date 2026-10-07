import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { OUT_OF_SERVICE_PRIORITIES } from "@/lib/maintenance/schema";
import { Constants } from "@/types/database";

import {
  asUser,
  createAsset,
  createTestDatabase,
  createUser,
  expectDbError,
  getRoom,
  PG,
} from "./helpers";

// Maintenance reporting: docs/16 Phase 11, docs/08 §2–10 and §30–32.

let db: PGlite;
const users = {} as Record<
  "admin" | "tech" | "studentA" | "studentB" | "staff" | "inactive",
  string
>;

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.tech = await createUser(db, "tech@test", "TECHNICIAN");
  users.studentA = await createUser(db, "a@test", "STUDENT");
  users.studentB = await createUser(db, "b@test", "STUDENT");
  users.staff = await createUser(db, "staff@test", "STAFF");
  users.inactive = await createUser(db, "gone@test", "STUDENT");
  await db.query("update public.profiles set is_active = false where id = $1", [
    users.inactive,
  ]);
});

async function report(
  userId: string | null,
  assetId: string,
  priority = "MEDIUM",
  description = "Projector powers on but shows no image.",
) {
  const { rows } = await asUser(db, userId, () =>
    db.query<{ n: string }>("select public.report_problem($1, $2, $3) as n", [
      assetId,
      description,
      priority,
    ]),
  );
  return rows[0].n;
}

async function requestRow(requestNumber: string) {
  const { rows } = await db.query<{
    id: string;
    asset_id: string;
    reported_by: string;
    status: string;
    priority: string;
    description: string;
    assigned_to: string | null;
  }>(
    `select id, asset_id, reported_by, status, priority, description, assigned_to
     from public.maintenance_requests where request_number = $1`,
    [requestNumber],
  );
  return rows[0];
}

async function assetStatus(id: string) {
  const { rows } = await db.query<{ status: string }>(
    "select status from public.assets where id = $1",
    [id],
  );
  return rows[0].status;
}

async function takeAsset(userId: string, assetId: string) {
  const room = await getRoom(db, "VK404");
  const { rows } = await asUser(db, userId, () =>
    db.query<{ id: string }>("select public.request_asset($1, $2, $3) as id", [
      assetId,
      room.building_id,
      room.id,
    ]),
  );
  return rows[0].id;
}

// ---------------------------------------------------------------------------

describe("report_problem", () => {
  it("creates_an_open_request_for_the_asset_with_the_caller_as_reporter", async () => {
    const asset = await createAsset(db);
    const number = await report(
      users.studentA,
      asset.id,
      "LOW",
      "  Remote missing  ",
    );

    expect(number).toMatch(/^MR-\d{4}-\d{4,}$/);
    expect(await requestRow(number)).toMatchObject({
      asset_id: asset.id,
      reported_by: users.studentA,
      status: "OPEN",
      priority: "LOW",
      description: "Remote missing",
      assigned_to: null,
    });
  });

  it.each(["staff", "tech", "admin"] as const)(
    "is_available_to_%s_too",
    async (who) => {
      const asset = await createAsset(db);
      const number = await report(users[who], asset.id, "LOW");
      expect((await requestRow(number)).reported_by).toBe(users[who]);
    },
  );

  it("records_the_report_in_history_and_the_audit_log", async () => {
    const asset = await createAsset(db);
    const number = await report(users.studentA, asset.id, "LOW");
    const { id } = await requestRow(number);

    const history = await db.query<{ action: string; performed_by: string }>(
      "select action, performed_by from public.maintenance_history where maintenance_request_id = $1",
      [id],
    );
    expect(history.rows).toEqual([
      { action: "REPORTED", performed_by: users.studentA },
    ]);

    const audit = await db.query<{
      action: string;
      actor_id: string;
      metadata: Record<string, unknown>;
    }>(
      "select action, actor_id, metadata from public.audit_logs where entity_id = $1",
      [id],
    );
    expect(audit.rows).toEqual([
      expect.objectContaining({
        action: "MAINTENANCE_CREATED",
        actor_id: users.studentA,
        metadata: expect.objectContaining({ request_number: number }),
      }),
    ]);
  });

  it("gives_every_report_its_own_number", async () => {
    const asset = await createAsset(db);
    const first = await report(users.studentA, asset.id, "LOW");
    const second = await report(users.studentB, asset.id, "LOW");
    expect(first).not.toBe(second);
  });

  it("requires_a_signed_in_active_user", async () => {
    const asset = await createAsset(db);
    await expectDbError(report(null, asset.id), PG.INSUFFICIENT_PRIVILEGE);
    await expectDbError(
      report(users.inactive, asset.id),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });

  it("refuses_retired_and_missing_assets", async () => {
    const asset = await createAsset(db);
    await db.query(
      "update public.assets set status = 'RETIRED' where id = $1",
      [asset.id],
    );
    await expectDbError(report(users.studentA, asset.id), "CA006");
    await expectDbError(
      report(users.studentA, "00000000-0000-4000-8000-000000000000"),
      "P0002",
    );
  });

  it("rejects_an_empty_description", async () => {
    const asset = await createAsset(db);
    await expectDbError(
      report(users.studentA, asset.id, "LOW", "   "),
      PG.CHECK_VIOLATION,
    );
  });
});

// ---------------------------------------------------------------------------

describe("asset status after a report", () => {
  it("matches_the_priorities_the_report_form_warns_about", async () => {
    // The form tells people which priorities take the asset out of service.
    const outOfService = [];
    for (const priority of Constants.public.Enums.maintenance_priority) {
      const asset = await createAsset(db);
      await report(users.staff, asset.id, priority);
      if ((await assetStatus(asset.id)) === "IN_MAINTENANCE")
        outOfService.push(priority);
    }
    expect(outOfService).toEqual([...OUT_OF_SERVICE_PRIORITIES]);
  });

  it.each(["HIGH", "CRITICAL"])(
    "takes_an_available_asset_out_of_service_for_%s",
    async (priority) => {
      const asset = await createAsset(db);
      await report(users.studentA, asset.id, priority);
      expect(await assetStatus(asset.id)).toBe("IN_MAINTENANCE");

      // ...so nobody can request it.
      await expectDbError(takeAsset(users.studentB, asset.id), "CA001");
    },
  );

  it.each(["LOW", "MEDIUM"])(
    "leaves_an_available_asset_in_use_for_%s",
    async (priority) => {
      const asset = await createAsset(db);
      await report(users.studentA, asset.id, priority);
      expect(await assetStatus(asset.id)).toBe("AVAILABLE");
    },
  );

  it("audits_the_status_change_with_the_reporter_as_actor", async () => {
    const asset = await createAsset(db);
    await report(users.studentA, asset.id, "HIGH");
    const { rows } = await db.query<{
      actor_id: string;
      new_values: { status: string };
    }>(
      "select actor_id, new_values from public.audit_logs where entity_id = $1 and action = 'ASSET_STATUS_CHANGED'",
      [asset.id],
    );
    expect(rows).toEqual([
      { actor_id: users.studentA, new_values: { status: "IN_MAINTENANCE" } },
    ]);
  });

  it("keeps_an_assigned_asset_with_its_user_until_it_is_returned", async () => {
    const asset = await createAsset(db);
    const assignment = await takeAsset(users.studentA, asset.id);

    await report(users.studentA, asset.id, "HIGH");
    expect(await assetStatus(asset.id)).toBe("ASSIGNED");
    const active = await db.query(
      "select 1 from public.asset_assignments where id = $1 and status = 'ACTIVE'",
      [assignment],
    );
    expect(active.rows).toHaveLength(1);

    // Returned while the problem is open: it goes to maintenance, not the pool.
    await asUser(db, users.studentA, () =>
      db.query("select public.return_asset($1)", [assignment]),
    );
    expect(await assetStatus(asset.id)).toBe("IN_MAINTENANCE");
    const { rows } = await db.query<{ new_values: { status: string } }>(
      "select new_values from public.audit_logs where entity_id = $1 and action = 'ASSET_RETURNED'",
      [asset.id],
    );
    expect(rows[0].new_values.status).toBe("IN_MAINTENANCE");
  });

  it("returns_to_the_pool_when_only_minor_or_closed_problems_remain", async () => {
    const asset = await createAsset(db);
    const assignment = await takeAsset(users.studentA, asset.id);
    await report(users.studentA, asset.id, "LOW");
    const serious = await report(users.studentA, asset.id, "HIGH");
    await db.query(
      "update public.maintenance_requests set status = 'CANCELLED' where request_number = $1",
      [serious],
    );

    await asUser(db, users.studentA, () =>
      db.query("select public.return_asset($1)", [assignment]),
    );
    expect(await assetStatus(asset.id)).toBe("AVAILABLE");
  });
});

// ---------------------------------------------------------------------------

describe("list_open_maintenance", () => {
  it("shows_anyone_signed_in_the_open_request_numbers_but_no_details", async () => {
    const asset = await createAsset(db);
    const open = await report(users.studentA, asset.id, "LOW");
    const closed = await report(users.studentA, asset.id, "LOW");
    await db.query(
      "update public.maintenance_requests set status = 'CANCELLED' where request_number = $1",
      [closed],
    );

    const { rows } = await asUser(db, users.studentB, () =>
      db.query<Record<string, unknown>>(
        "select * from public.list_open_maintenance($1)",
        [asset.id],
      ),
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      "created_at",
      "request_number",
      "status",
    ]);
    expect(rows[0]).toMatchObject({ request_number: open, status: "OPEN" });

    // The request itself stays private to its reporter.
    const direct = await asUser(db, users.studentB, () =>
      db.query(
        "select 1 from public.maintenance_requests where asset_id = $1",
        [asset.id],
      ),
    );
    expect(direct.rows).toHaveLength(0);
  });

  it("returns_nothing_to_deactivated_users", async () => {
    const asset = await createAsset(db);
    await report(users.studentA, asset.id, "LOW");
    const { rows } = await asUser(db, users.inactive, () =>
      db.query("select * from public.list_open_maintenance($1)", [asset.id]),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("maintenance function privileges", () => {
  it.each([
    "report_problem(uuid, text, maintenance_priority)",
    "list_open_maintenance(uuid)",
  ])("only_signed_in_users_can_execute_%s", async (signature) => {
    const { rows } = await db.query<{ anon: boolean; authed: boolean }>(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authed`,
      [`public.${signature}`],
    );
    expect(rows[0]).toEqual({ anon: false, authed: true });
  });

  it("keeps_the_service_rule_private", async () => {
    const { rows } = await db.query<{ authed: boolean }>(
      "select has_function_privilege('authenticated', 'private.asset_needs_service(uuid)', 'execute') as authed",
    );
    expect(rows[0].authed).toBe(false);
  });
});
