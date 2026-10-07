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

// request_asset workflow: docs/16 Phase 9 and docs/14 §21–24.

let db: PGlite;
let studentA: string;
let studentB: string;
let inactive: string;

beforeAll(async () => {
  db = await createTestDatabase();
  studentA = await createUser(db, "a@test", "STUDENT");
  studentB = await createUser(db, "b@test", "STUDENT");
  inactive = await createUser(db, "gone@test", "STUDENT");
  await db.query("update public.profiles set is_active = false where id = $1", [
    inactive,
  ]);
});

async function request(
  userId: string | null,
  assetId: string,
  roomNumber: string,
  options: {
    buildingOf?: string;
    expectedReturn?: string | null;
    notes?: string;
  } = {},
) {
  const room = await getRoom(db, roomNumber);
  const building = options.buildingOf
    ? (await getRoom(db, options.buildingOf)).building_id
    : room.building_id;
  return asUser(db, userId, () =>
    db.query<{ id: string }>(
      "select public.request_asset($1, $2, $3, $4, $5) as id",
      [
        assetId,
        building,
        room.id,
        options.expectedReturn ?? null,
        options.notes ?? null,
      ],
    ),
  );
}

async function assetRow(id: string) {
  const { rows } = await db.query<{
    status: string;
    registered_room: string;
  }>(
    `select a.status, r.room_number as registered_room
     from public.assets a join public.rooms r on r.id = a.registered_room_id
     where a.id = $1`,
    [id],
  );
  return rows[0];
}

describe("request_asset", () => {
  it("assigns_the_asset_at_the_usage_location_without_moving_its_home", async () => {
    const asset = await createAsset(db, "VY001");
    const { rows } = await request(studentA, asset.id, "VK404", {
      expectedReturn: new Date(Date.now() + 86_400_000).toISOString(),
      notes: "  Seminar  ",
    });

    const assignment = await db.query<{
      user_id: string;
      status: string;
      usage_room: string;
      created_by: string;
      notes: string;
    }>(
      `select aa.user_id, aa.status, r.room_number as usage_room, aa.created_by, aa.notes
       from public.asset_assignments aa join public.rooms r on r.id = aa.usage_room_id
       where aa.id = $1`,
      [rows[0].id],
    );
    expect(assignment.rows[0]).toEqual({
      user_id: studentA,
      status: "ACTIVE",
      usage_room: "VK404",
      created_by: studentA,
      notes: "Seminar",
    });
    // The critical rule: registered location stays Vyas / VY001.
    expect(await assetRow(asset.id)).toEqual({
      status: "ASSIGNED",
      registered_room: "VY001",
    });
  });

  it("records_one_assigned_audit_event_with_the_requester_as_actor", async () => {
    const asset = await createAsset(db);
    await request(studentA, asset.id, "VK404");
    const { rows } = await db.query<{
      action: string;
      actor_id: string;
      metadata: Record<string, unknown>;
    }>(
      `select action, actor_id, metadata from public.audit_logs
       where entity_id = $1 and action <> 'ASSET_CREATED' order by created_at`,
      [asset.id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "ASSET_ASSIGNED",
      actor_id: studentA,
      metadata: { usage_building: "VK", usage_room: "VK404" },
    });
  });

  it("lets_only_one_of_two_requests_succeed", async () => {
    const asset = await createAsset(db);
    await request(studentA, asset.id, "VK404");
    await expectDbError(request(studentB, asset.id, "VK301"), "CA001");

    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.asset_assignments where asset_id = $1 and status = 'ACTIVE'",
      [asset.id],
    );
    expect(rows[0].n).toBe(1);
  });

  it("falls_back_on_the_unique_index_if_status_and_assignments_disagree", async () => {
    const asset = await createAsset(db);
    const room = await getRoom(db, "VK404");
    // Simulate a stray ACTIVE assignment while the asset still says AVAILABLE.
    await db.query(
      `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
       values ($1, $2, $3, $4)`,
      [asset.id, studentB, room.building_id, room.id],
    );
    await expectDbError(request(studentA, asset.id, "VK404"), "CA001");
    expect((await assetRow(asset.id)).status).toBe("AVAILABLE");
  });

  it.each(["IN_MAINTENANCE", "DAMAGED", "LOST", "RETIRED"])(
    "refuses_assets_that_are_%s",
    async (status) => {
      const asset = await createAsset(db);
      await db.query("update public.assets set status = $1 where id = $2", [
        status,
        asset.id,
      ]);
      await expectDbError(request(studentA, asset.id, "VK404"), "CA001");
    },
  );

  it("rejects_a_room_from_another_building", async () => {
    const asset = await createAsset(db);
    await expectDbError(
      request(studentA, asset.id, "VK404", { buildingOf: "VY001" }),
      "CA002",
    );
    expect((await assetRow(asset.id)).status).toBe("AVAILABLE");
  });

  it("rejects_inactive_rooms", async () => {
    const asset = await createAsset(db);
    const room = await getRoom(db, "VK405");
    await db.query("update public.rooms set is_active = false where id = $1", [
      room.id,
    ]);
    try {
      await expectDbError(request(studentA, asset.id, "VK405"), "CA002");
    } finally {
      await db.query("update public.rooms set is_active = true where id = $1", [
        room.id,
      ]);
    }
  });

  it("rejects_an_expected_return_in_the_past_or_too_far_ahead", async () => {
    const asset = await createAsset(db);
    await expectDbError(
      request(studentA, asset.id, "VK404", {
        expectedReturn: "2020-01-01T00:00:00Z",
      }),
      "CA003",
    );
    const tooFar = new Date(Date.now() + 400 * 86_400_000).toISOString();
    await expectDbError(
      request(studentA, asset.id, "VK404", { expectedReturn: tooFar }),
      "CA003",
    );
  });

  it("reports_a_missing_asset", async () => {
    await expectDbError(
      request(studentA, "00000000-0000-4000-8000-000000000000", "VK404"),
      "P0002",
    );
  });

  it("is_not_available_to_anonymous_or_inactive_users", async () => {
    const asset = await createAsset(db);
    await expectDbError(
      request(null, asset.id, "VK404"),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    await expectDbError(
      request(inactive, asset.id, "VK404"),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    expect((await assetRow(asset.id)).status).toBe("AVAILABLE");
  });

  it("shows_the_requester_their_assignment_but_not_other_peoples", async () => {
    const asset = await createAsset(db);
    await request(studentA, asset.id, "VK404");
    const count = (userId: string) =>
      asUser(db, userId, () =>
        db.query<{ n: number }>(
          "select count(*)::int as n from public.asset_assignments where asset_id = $1",
          [asset.id],
        ),
      );
    expect((await count(studentA)).rows[0].n).toBe(1);
    expect((await count(studentB)).rows[0].n).toBe(0);
  });
});
