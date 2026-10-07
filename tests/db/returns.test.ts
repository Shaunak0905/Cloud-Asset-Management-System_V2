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

// Return, admin assign and transfer workflows: docs/16 Phase 10,
// docs/06 §21–22 and docs/14 §25.

let db: PGlite;
let admin: string;
let studentA: string;
let studentB: string;
let inactive: string;

beforeAll(async () => {
  db = await createTestDatabase();
  admin = await createUser(db, "admin@test", "ADMIN");
  studentA = await createUser(db, "a@test", "STUDENT");
  studentB = await createUser(db, "b@test", "STUDENT");
  inactive = await createUser(db, "gone@test", "STUDENT");
  await db.query("update public.profiles set is_active = false where id = $1", [
    inactive,
  ]);
});

async function request(userId: string, assetId: string, roomNumber = "VK404") {
  const room = await getRoom(db, roomNumber);
  const { rows } = await asUser(db, userId, () =>
    db.query<{ id: string }>("select public.request_asset($1, $2, $3) as id", [
      assetId,
      room.building_id,
      room.id,
    ]),
  );
  return rows[0].id;
}

function returnAsset(userId: string | null, assignmentId: string) {
  return asUser(db, userId, () =>
    db.query("select public.return_asset($1)", [assignmentId]),
  );
}

async function assign(
  userId: string,
  assetId: string,
  assignee: string,
  roomNumber = "VK301",
) {
  const room = await getRoom(db, roomNumber);
  return asUser(db, userId, () =>
    db.query<{ id: string }>(
      "select public.assign_asset($1, $2, $3, $4) as id",
      [assetId, assignee, room.building_id, room.id],
    ),
  );
}

async function transfer(
  userId: string,
  assignmentId: string,
  toUser: string,
  roomNumber = "VK301",
  options: { buildingOf?: string } = {},
) {
  const room = await getRoom(db, roomNumber);
  const building = options.buildingOf
    ? (await getRoom(db, options.buildingOf)).building_id
    : room.building_id;
  return asUser(db, userId, () =>
    db.query<{ id: string }>(
      "select public.transfer_asset($1, $2, $3, $4) as id",
      [assignmentId, toUser, building, room.id],
    ),
  );
}

async function assetStatus(id: string) {
  const { rows } = await db.query<{ status: string; home: string }>(
    `select a.status, r.room_number as home
     from public.assets a join public.rooms r on r.id = a.registered_room_id
     where a.id = $1`,
    [id],
  );
  return rows[0];
}

async function assignments(assetId: string) {
  const { rows } = await db.query<{
    id: string;
    user_id: string;
    status: string;
    returned_at: Date | null;
    usage_room: string;
    created_by: string;
  }>(
    `select aa.id, aa.user_id, aa.status, aa.returned_at, r.room_number as usage_room, aa.created_by
     from public.asset_assignments aa join public.rooms r on r.id = aa.usage_room_id
     where aa.asset_id = $1 order by aa.created_at, aa.status`,
    [assetId],
  );
  return rows;
}

async function auditTrail(assetId: string) {
  const { rows } = await db.query<{
    action: string;
    actor_id: string;
    metadata: Record<string, unknown>;
  }>(
    `select action, actor_id, metadata from public.audit_logs
     where entity_id = $1 and action <> 'ASSET_CREATED' order by created_at, id`,
    [assetId],
  );
  return rows;
}

// ---------------------------------------------------------------------------

describe("return_asset", () => {
  it("closes_the_assignment_and_makes_the_asset_available", async () => {
    const asset = await createAsset(db, "VY001");
    const assignmentId = await request(studentA, asset.id);

    await returnAsset(studentA, assignmentId);

    const [row] = await assignments(asset.id);
    expect(row).toMatchObject({ status: "RETURNED", usage_room: "VK404" });
    expect(row.returned_at).toBeInstanceOf(Date);
    // The registered location is never changed by use elsewhere.
    expect(await assetStatus(asset.id)).toEqual({
      status: "AVAILABLE",
      home: "VY001",
    });
  });

  it("records_one_returned_audit_event_with_the_returner_as_actor", async () => {
    const asset = await createAsset(db);
    const assignmentId = await request(studentA, asset.id);
    await returnAsset(studentA, assignmentId);

    const trail = await auditTrail(asset.id);
    expect(trail.map((r) => r.action)).toEqual([
      "ASSET_ASSIGNED",
      "ASSET_RETURNED",
    ]);
    expect(trail[1]).toMatchObject({
      actor_id: studentA,
      metadata: { assignment_id: assignmentId },
    });
    expect(trail[1].metadata.returned_at).toEqual(expect.any(String));
  });

  it("keeps_history_when_the_asset_is_used_again", async () => {
    const asset = await createAsset(db);
    await returnAsset(studentA, await request(studentA, asset.id));
    await request(studentB, asset.id, "VK301");

    expect(
      (await assignments(asset.id)).map((r) => [r.user_id, r.status]),
    ).toEqual([
      [studentA, "RETURNED"],
      [studentB, "ACTIVE"],
    ]);
  });

  it("denies_returning_another_users_assignment", async () => {
    const asset = await createAsset(db);
    const assignmentId = await request(studentA, asset.id);

    await expectDbError(
      returnAsset(studentB, assignmentId),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    expect((await assignments(asset.id))[0].status).toBe("ACTIVE");
    expect((await assetStatus(asset.id)).status).toBe("ASSIGNED");
  });

  it("lets_an_admin_return_any_assignment", async () => {
    const asset = await createAsset(db);
    const assignmentId = await request(studentA, asset.id);

    await returnAsset(admin, assignmentId);

    expect((await assetStatus(asset.id)).status).toBe("AVAILABLE");
    expect((await auditTrail(asset.id)).at(-1)).toMatchObject({
      action: "ASSET_RETURNED",
      actor_id: admin,
    });
  });

  it("refuses_to_return_twice", async () => {
    const asset = await createAsset(db);
    const assignmentId = await request(studentA, asset.id);
    await returnAsset(studentA, assignmentId);

    await expectDbError(returnAsset(studentA, assignmentId), "CA004");
    expect(
      (await auditTrail(asset.id)).filter((r) => r.action === "ASSET_RETURNED"),
    ).toHaveLength(1);
  });

  it("reports_a_missing_assignment", async () => {
    await expectDbError(
      returnAsset(studentA, "00000000-0000-4000-8000-000000000000"),
      "P0002",
    );
  });

  it("is_not_available_to_anonymous_or_deactivated_users", async () => {
    const asset = await createAsset(db);
    const assignmentId = await request(studentA, asset.id);
    await expectDbError(
      returnAsset(null, assignmentId),
      PG.INSUFFICIENT_PRIVILEGE,
    );

    await db.query(
      "update public.profiles set is_active = false where id = $1",
      [studentA],
    );
    try {
      await expectDbError(
        returnAsset(studentA, assignmentId),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    } finally {
      await db.query(
        "update public.profiles set is_active = true where id = $1",
        [studentA],
      );
    }
    expect((await assetStatus(asset.id)).status).toBe("ASSIGNED");
  });
});

// ---------------------------------------------------------------------------

describe("assign_asset", () => {
  it("lets_an_admin_give_an_available_asset_to_a_user", async () => {
    const asset = await createAsset(db, "VY001");
    const { rows } = await assign(admin, asset.id, studentB, "VK301");

    expect(await assignments(asset.id)).toEqual([
      expect.objectContaining({
        id: rows[0].id,
        user_id: studentB,
        status: "ACTIVE",
        usage_room: "VK301",
        created_by: admin,
      }),
    ]);
    expect(await assetStatus(asset.id)).toEqual({
      status: "ASSIGNED",
      home: "VY001",
    });
    expect(await auditTrail(asset.id)).toEqual([
      expect.objectContaining({ action: "ASSET_ASSIGNED", actor_id: admin }),
    ]);

    // The assignee sees it as their own.
    const visible = await asUser(db, studentB, () =>
      db.query("select id from public.asset_assignments where id = $1", [
        rows[0].id,
      ]),
    );
    expect(visible.rows).toHaveLength(1);
  });

  it("is_admin_only", async () => {
    const asset = await createAsset(db);
    await expectDbError(
      assign(studentA, asset.id, studentA),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    expect((await assetStatus(asset.id)).status).toBe("AVAILABLE");
  });

  it("refuses_assets_that_are_not_available", async () => {
    const asset = await createAsset(db);
    await request(studentA, asset.id);
    await expectDbError(assign(admin, asset.id, studentB), "CA001");
  });

  it.each([
    ["deactivated", () => inactive],
    ["unknown", () => "00000000-0000-4000-8000-000000000000"],
  ])("refuses_%s_users", async (_, user) => {
    const asset = await createAsset(db);
    await expectDbError(assign(admin, asset.id, user()), "CA005");
    expect((await assetStatus(asset.id)).status).toBe("AVAILABLE");
  });
});

// ---------------------------------------------------------------------------

describe("transfer_asset", () => {
  it("closes_the_old_assignment_and_opens_a_new_one", async () => {
    const asset = await createAsset(db, "VY001");
    const fromId = await request(studentA, asset.id, "VK404");

    const { rows } = await transfer(admin, fromId, studentB, "VK301");
    const toId = rows[0].id;

    const history = await assignments(asset.id);
    expect(history).toHaveLength(2);
    expect(history.find((r) => r.id === fromId)).toMatchObject({
      user_id: studentA,
      status: "TRANSFERRED",
      usage_room: "VK404",
    });
    expect(history.find((r) => r.id === fromId)?.returned_at).toBeInstanceOf(
      Date,
    );
    expect(history.find((r) => r.id === toId)).toMatchObject({
      user_id: studentB,
      status: "ACTIVE",
      usage_room: "VK301",
      created_by: admin,
    });
    expect(await assetStatus(asset.id)).toEqual({
      status: "ASSIGNED",
      home: "VY001",
    });
  });

  it("records_the_transfer_without_a_status_change_event", async () => {
    const asset = await createAsset(db);
    const fromId = await request(studentA, asset.id);
    const { rows } = await transfer(admin, fromId, studentB);

    const trail = await auditTrail(asset.id);
    expect(trail.map((r) => r.action)).toEqual([
      "ASSET_ASSIGNED",
      "ASSET_TRANSFERRED",
    ]);
    expect(trail[1]).toMatchObject({
      actor_id: admin,
      metadata: {
        from_assignment_id: fromId,
        to_assignment_id: rows[0].id,
        usage_building: "VK",
        usage_room: "VK301",
      },
    });
  });

  it("leaves_the_previous_user_their_history_and_gives_the_new_user_the_asset", async () => {
    const asset = await createAsset(db);
    const fromId = await request(studentA, asset.id);
    const { rows } = await transfer(admin, fromId, studentB);

    const visible = (userId: string) =>
      asUser(db, userId, () =>
        db.query<{ id: string; status: string }>(
          "select id, status from public.asset_assignments where asset_id = $1",
          [asset.id],
        ),
      );
    expect((await visible(studentA)).rows).toEqual([
      { id: fromId, status: "TRANSFERRED" },
    ]);
    expect((await visible(studentB)).rows).toEqual([
      { id: rows[0].id, status: "ACTIVE" },
    ]);

    // The new holder can return it; the old one no longer can.
    await expectDbError(returnAsset(studentA, fromId), "CA004");
    await returnAsset(studentB, rows[0].id);
    expect((await assetStatus(asset.id)).status).toBe("AVAILABLE");
  });

  it("is_admin_only_even_for_the_current_holder", async () => {
    const asset = await createAsset(db);
    const fromId = await request(studentA, asset.id);
    await expectDbError(
      transfer(studentA, fromId, studentB),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    expect((await assignments(asset.id))[0].status).toBe("ACTIVE");
  });

  it("refuses_a_closed_assignment", async () => {
    const asset = await createAsset(db);
    const fromId = await request(studentA, asset.id);
    await returnAsset(studentA, fromId);

    await expectDbError(transfer(admin, fromId, studentB), "CA004");
    expect((await assetStatus(asset.id)).status).toBe("AVAILABLE");
  });

  it("refuses_a_deactivated_recipient", async () => {
    const asset = await createAsset(db);
    const fromId = await request(studentA, asset.id);
    await expectDbError(transfer(admin, fromId, inactive), "CA005");
  });

  it("keeps_the_old_assignment_if_the_new_location_is_invalid", async () => {
    const asset = await createAsset(db);
    const fromId = await request(studentA, asset.id);

    await expectDbError(
      transfer(admin, fromId, studentB, "VK404", { buildingOf: "VY001" }),
      "CA002",
    );
    expect((await assignments(asset.id)).map((r) => [r.id, r.status])).toEqual([
      [fromId, "ACTIVE"],
    ]);
    expect((await auditTrail(asset.id)).map((r) => r.action)).not.toContain(
      "ASSET_TRANSFERRED",
    );
  });
});

describe("workflow function privileges", () => {
  it.each([
    "return_asset(uuid)",
    "assign_asset(uuid, uuid, uuid, uuid, timestamptz, text)",
    "transfer_asset(uuid, uuid, uuid, uuid, timestamptz, text)",
  ])("anonymous_cannot_execute_%s", async (signature) => {
    const { rows } = await db.query<{ anon: boolean; authed: boolean }>(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authed`,
      [`public.${signature}`],
    );
    expect(rows[0]).toEqual({ anon: false, authed: true });
  });

  it.each([
    "open_assignment(uuid, uuid, uuid, uuid, timestamptz, text)",
    "assign_available_asset(uuid, uuid, uuid, uuid, timestamptz, text)",
  ])("api_roles_cannot_call_private_%s", async (signature) => {
    const { rows } = await db.query<{ authed: boolean }>(
      "select has_function_privilege('authenticated', $1, 'execute') as authed",
      [`private.${signature}`],
    );
    expect(rows[0].authed).toBe(false);
  });
});
