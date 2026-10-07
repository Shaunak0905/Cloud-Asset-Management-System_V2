import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  asUser,
  createAsset,
  createTestDatabase,
  createUser,
  expectDbError,
  getRoom,
  PG,
} from "./helpers";

// Dashboards: docs/16 Phase 17, docs/12 §17, §38–41, §45–46.

let db: PGlite;
const users = {} as Record<
  "admin" | "techA" | "techB" | "student" | "staff",
  string
>;
/** Start of "this month" passed to the dashboards (an hour ago). */
let monthStart: string;

type Json = Record<string, unknown>;

async function rpc(userId: string, sql: string, params: unknown[] = []) {
  const { rows } = await asUser(db, userId, () =>
    db.query<{ result: Json }>(sql, params),
  );
  return rows[0].result;
}

const adminDashboard = (userId = users.admin) =>
  rpc(userId, "select public.admin_dashboard($1) as result", [monthStart]);
const technicianDashboard = (userId: string) =>
  rpc(userId, "select public.technician_dashboard($1) as result", [monthStart]);
const myDashboard = (userId: string) =>
  rpc(userId, "select public.my_dashboard() as result");

async function report(userId: string, assetId: string, priority: string) {
  const { rows } = await asUser(db, userId, () =>
    db.query<{ n: string }>(
      "select public.report_problem($1, 'Broken', $2) as n",
      [assetId, priority],
    ),
  );
  const found = await db.query<{ id: string }>(
    "select id from public.maintenance_requests where request_number = $1",
    [rows[0].n],
  );
  return found.rows[0].id;
}

async function assign(requestId: string, technician: string) {
  await asUser(db, users.admin, () =>
    db.query("select public.assign_technician($1, $2)", [
      requestId,
      technician,
    ]),
  );
}

async function start(requestId: string, technician: string) {
  await asUser(db, technician, () =>
    db.query("select public.start_maintenance($1)", [requestId]),
  );
}

async function resolve(requestId: string, technician: string) {
  await asUser(db, technician, () =>
    db.query("select public.resolve_maintenance($1, 'Fixed', 'AVAILABLE')", [
      requestId,
    ]),
  );
}

async function take(userId: string, assetId: string) {
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

/** Puts an assignment's expected return in the past. */
async function makeOverdue(assignmentId: string) {
  await db.query(
    `update public.asset_assignments
     set expected_return_at = assigned_at + interval '1 millisecond'
     where id = $1`,
    [assignmentId],
  );
}

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.techA = await createUser(db, "tech-a@test", "TECHNICIAN");
  users.techB = await createUser(db, "tech-b@test", "TECHNICIAN");
  users.student = await createUser(db, "student@test", "STUDENT");
  users.staff = await createUser(db, "staff@test", "STAFF");
  await db.query(
    "update public.profiles set full_name = 'Ravi Kumar' where id = $1",
    [users.techA],
  );
  monthStart = (
    await db.query<{ t: string }>(
      "select (now() - interval '1 hour')::text as t",
    )
  ).rows[0].t;

  // Technician A: one assigned, one in progress (HIGH), one resolved.
  // Technician B: one assigned (CRITICAL). One OPEN HIGH, one OPEN LOW.
  const assigned = await report(
    users.student,
    (await createAsset(db)).id,
    "LOW",
  );
  await assign(assigned, users.techA);
  const working = await report(
    users.student,
    (await createAsset(db)).id,
    "HIGH",
  );
  await assign(working, users.techA);
  await start(working, users.techA);
  const done = await report(users.staff, (await createAsset(db)).id, "MEDIUM");
  await assign(done, users.techA);
  await start(done, users.techA);
  await resolve(done, users.techA);
  const critical = await report(
    users.staff,
    (await createAsset(db)).id,
    "CRITICAL",
  );
  await assign(critical, users.techB);
  await report(users.student, (await createAsset(db)).id, "HIGH");
  await report(users.staff, (await createAsset(db)).id, "LOW");

  // The student uses two assets; one is overdue. Staff uses one, on time.
  const first = await take(users.student, (await createAsset(db)).id);
  await take(users.student, (await createAsset(db)).id);
  await makeOverdue(first);
  await take(users.staff, (await createAsset(db)).id);

  // A retired asset counts in the total, but not in the inventory views.
  const retired = await createAsset(db);
  await db.query("update public.assets set status = 'RETIRED' where id = $1", [
    retired.id,
  ]);
});

describe("admin_dashboard", () => {
  it("counts_assets_by_status_in_the_database", async () => {
    const dashboard = await adminDashboard();
    const { rows } = await db.query<{ status: string; n: number }>(
      "select status, count(*)::int as n from public.assets group by status",
    );
    expect(dashboard.assets_by_status).toEqual(
      Object.fromEntries(rows.map((r) => [r.status, r.n])),
    );
  });

  it("counts_maintenance_by_status_and_open_work_by_priority", async () => {
    const dashboard = await adminDashboard();
    expect(dashboard.maintenance_by_status).toEqual({
      OPEN: 2,
      ASSIGNED: 2,
      IN_PROGRESS: 1,
      RESOLVED: 1,
    });
    expect(dashboard.open_by_priority).toEqual({
      LOW: 2,
      HIGH: 2,
      CRITICAL: 1,
    });
    // OPEN and HIGH/CRITICAL: nobody is on it yet.
    expect(dashboard.unassigned_serious).toBe(1);
  });

  it("counts_resolutions_since_the_start_of_the_month", async () => {
    expect((await adminDashboard()).resolved_this_month).toBe(1);
    const future = await rpc(
      users.admin,
      "select public.admin_dashboard(now() + interval '1 day') as result",
    );
    expect(future.resolved_this_month).toBe(0);
  });

  it("counts_active_and_overdue_assignments", async () => {
    const dashboard = await adminDashboard();
    expect(dashboard.active_assignments).toBe(3);
    expect(dashboard.overdue_assignments).toBe(1);
  });

  it("groups_the_inventory_without_retired_assets", async () => {
    const dashboard = await adminDashboard();
    const byBuilding = dashboard.assets_by_building as Array<{
      label: string;
      count: number;
    }>;
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.assets where status <> 'RETIRED'",
    );
    expect(byBuilding.reduce((sum, b) => sum + b.count, 0)).toBe(rows[0].n);
    const byCategory = dashboard.assets_by_category as Array<{ count: number }>;
    expect(byCategory.reduce((sum, c) => sum + c.count, 0)).toBe(rows[0].n);
    // Largest first.
    expect(byBuilding.map((b) => b.count)).toEqual(
      [...byBuilding.map((b) => b.count)].sort((a, b) => b - a),
    );
  });

  it("shows_each_active_technicians_workload", async () => {
    const dashboard = await adminDashboard();
    // Sorted by name: "Ravi Kumar" before "tech-b…".
    expect(dashboard.technicians).toEqual([
      {
        id: users.techA,
        name: "Ravi Kumar",
        assigned: 1,
        in_progress: 1,
        resolved_this_month: 1,
      },
      expect.objectContaining({ id: users.techB, assigned: 1, in_progress: 0 }),
    ]);
  });

  it("is_refused_to_everyone_else", async () => {
    for (const who of [users.techA, users.student, users.staff]) {
      await expectDbError(adminDashboard(who), PG.INSUFFICIENT_PRIVILEGE);
    }
  });
});

describe("technician_dashboard", () => {
  it("counts_only_the_callers_assigned_work", async () => {
    expect(await technicianDashboard(users.techA)).toEqual({
      assigned: 1,
      in_progress: 1,
      serious: 1,
      resolved_this_month: 1,
    });
    expect(await technicianDashboard(users.techB)).toEqual({
      assigned: 1,
      in_progress: 0,
      serious: 1,
      resolved_this_month: 0,
    });
  });

  it("gives_people_with_no_assigned_work_zeros", async () => {
    expect(await technicianDashboard(users.student)).toEqual({
      assigned: 0,
      in_progress: 0,
      serious: 0,
      resolved_this_month: 0,
    });
  });
});

describe("my_dashboard", () => {
  it("counts_the_callers_own_assets_and_open_reports", async () => {
    expect(await myDashboard(users.student)).toEqual({
      active_assignments: 2,
      overdue_assignments: 1,
      // assigned (LOW), in progress (HIGH) and open (HIGH); resolved excluded
      open_reports: 3,
    });
    expect(await myDashboard(users.staff)).toEqual({
      active_assignments: 1,
      overdue_assignments: 0,
      open_reports: 2,
    });
  });

  it("never_counts_other_peoples_records", async () => {
    expect(await myDashboard(users.techB)).toEqual({
      active_assignments: 0,
      overdue_assignments: 0,
      open_reports: 0,
    });
  });
});

describe("dashboard function privileges", () => {
  it.each([
    "admin_dashboard(timestamptz)",
    "technician_dashboard(timestamptz)",
    "my_dashboard()",
  ])("only_signed_in_users_can_execute_%s", async (signature) => {
    const { rows } = await db.query<{
      anon: boolean;
      authed: boolean;
      definer: boolean;
    }>(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authed,
              (select prosecdef from pg_proc where oid = $1::regprocedure) as definer`,
      [`public.${signature}`],
    );
    // Runs as the caller, so RLS limits what is counted.
    expect(rows[0]).toEqual({ anon: false, authed: true, definer: false });
  });
});
