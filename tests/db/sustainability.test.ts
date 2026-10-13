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

// Sustainability figures (UN SDG 12) on the admin dashboard:
// supabase/migrations/…_sustainability_dashboard.sql. A fresh database, so
// every count below is exactly what this file set up.

const ZONE = "Asia/Kolkata";

let db: PGlite;
const users = {} as Record<
  "admin" | "technician" | "studentA" | "studentB",
  string
>;

async function report(assetId: string, reporter = users.studentA) {
  const { rows } = await asUser(db, reporter, () =>
    db.query<{ n: string }>(
      "select public.report_problem($1, 'It stopped working.', 'LOW') as n",
      [assetId],
    ),
  );
  return (
    await db.query<{ id: string }>(
      "select id from public.maintenance_requests where request_number = $1",
      [rows[0].n],
    )
  ).rows[0].id;
}

/** Assigns and starts the request, then resolves it as `by`. */
async function repair(
  requestId: string,
  finalState: string | null,
  by = users.technician,
) {
  await asUser(db, users.admin, () =>
    db.query("select public.assign_technician($1, $2)", [
      requestId,
      users.technician,
    ]),
  );
  await asUser(db, users.technician, () =>
    db.query("select public.start_maintenance($1)", [requestId]),
  );
  await asUser(db, by, () =>
    db.query("select public.resolve_maintenance($1, 'Done.', $2)", [
      requestId,
      finalState,
    ]),
  );
}

async function borrow(userId: string, assetId: string) {
  const room = await getRoom(db, "VK404");
  return (
    await asUser(db, userId, () =>
      db.query<{ id: string }>(
        "select public.request_asset($1, $2, $3) as id",
        [assetId, room.building_id, room.id],
      ),
    )
  ).rows[0].id;
}

async function giveBack(userId: string, assignmentId: string) {
  await asUser(db, userId, () =>
    db.query("select public.return_asset($1)", [assignmentId]),
  );
}

/** Sets the warranty end relative to today's campus date. */
async function warrantyEnds(assetId: string, daysFromToday: number) {
  await db.query(
    `update public.assets
     set warranty_until = (now() at time zone $2)::date + $3::int
     where id = $1`,
    [assetId, ZONE, daysFromToday],
  );
}

async function sustainability(userId: string | null) {
  const { rows } = await asUser(db, userId, () =>
    db.query<{ result: Record<string, unknown> }>(
      "select public.sustainability_dashboard($1) as result",
      [ZONE],
    ),
  );
  return rows[0].result;
}

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.technician = await createUser(db, "tech@test", "TECHNICIAN");
  users.studentA = await createUser(db, "a@test", "STUDENT");
  users.studentB = await createUser(db, "b@test", "STUDENT");

  // Repairs: back in service, still damaged, retired (admins only), and
  // fixed while someone was using it (it stays with them: in service).
  await repair(await report((await createAsset(db)).id), "AVAILABLE");
  await repair(await report((await createAsset(db)).id), "DAMAGED");
  await repair(
    await report((await createAsset(db)).id),
    "RETIRED",
    users.admin,
  );

  // Sharing: one projector used by two people (fixed in between), one
  // laptop borrowed twice by the same person, one cancelled loan.
  const projector = (await createAsset(db)).id;
  const first = await borrow(users.studentA, projector);
  await repair(await report(projector), null);
  await giveBack(users.studentA, first);
  await borrow(users.studentB, projector);

  const laptop = (await createAsset(db)).id;
  await giveBack(users.studentA, await borrow(users.studentA, laptop));
  await borrow(users.studentA, laptop);

  const cancelled = await borrow(users.studentB, (await createAsset(db)).id);
  await db.query(
    "update public.asset_assignments set status = 'CANCELLED' where id = $1",
    [cancelled],
  );

  // Warranty: open and covered; reported after it ended; cancelled; and
  // reported on the last day of the warranty, then repaired.
  const covered = (await createAsset(db)).id;
  await warrantyEnds(covered, 30);
  await report(covered);

  const expired = (await createAsset(db)).id;
  await warrantyEnds(expired, -10);
  await report(expired);

  const withdrawn = (await createAsset(db)).id;
  await warrantyEnds(withdrawn, 30);
  const withdrawnRequest = await report(withdrawn);
  await asUser(db, users.admin, () =>
    db.query("select public.cancel_maintenance($1, 'Reported by mistake')", [
      withdrawnRequest,
    ]),
  );

  const lastDay = (await createAsset(db)).id;
  await warrantyEnds(lastDay, 0);
  await repair(await report(lastDay), "AVAILABLE");
});

describe("sustainability_dashboard", () => {
  it("counts_repairs_shared_equipment_and_warranty_cover", async () => {
    expect(await sustainability(users.admin)).toEqual({
      // In service: the first repair, the projector (stayed with its user)
      // and the last-day warranty repair.
      repairs: { repaired: 3, still_damaged: 1, retired: 1 },
      // Projector twice (two people) and laptop twice (one person); the
      // cancelled loan does not count.
      sharing: { loans: 4, assets_shared: 1 },
      // The open covered request and the last-day one; not the request made
      // after the warranty ended, nor the cancelled one.
      warranty: { reported_under_warranty: 2, open_under_warranty: 1 },
    });
  });

  it("is_for_admins_only", async () => {
    for (const userId of [users.technician, users.studentA]) {
      await expectDbError(sustainability(userId), PG.INSUFFICIENT_PRIVILEGE);
    }
    await expectDbError(sustainability(null), PG.INSUFFICIENT_PRIVILEGE);
  });
});
