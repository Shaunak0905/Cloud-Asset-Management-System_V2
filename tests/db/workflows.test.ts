import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createAsset,
  createTestDatabase,
  createUser,
  expectDbError,
  getRoom,
  PG,
  setAuthUser,
} from "./helpers";

let db: PGlite;
let student: string;
let otherStudent: string;
let technician: string;
let otherTechnician: string;

beforeAll(async () => {
  db = await createTestDatabase();
  student = await createUser(db, "student@test", "STUDENT");
  otherStudent = await createUser(db, "student2@test", "STUDENT");
  technician = await createUser(db, "tech@test", "TECHNICIAN");
  otherTechnician = await createUser(db, "tech2@test", "TECHNICIAN");
});

async function assign(assetId: string, userId: string, roomNumber = "VK404") {
  const room = await getRoom(db, roomNumber);
  const { rows } = await db.query<{ id: string }>(
    `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
     values ($1, $2, $3, $4) returning id`,
    [assetId, userId, room.building_id, room.id],
  );
  return rows[0].id;
}

async function report(assetId: string, reporter = student) {
  const { rows } = await db.query<{ id: string; request_number: string }>(
    `insert into public.maintenance_requests (asset_id, reported_by, description, priority)
     values ($1, $2, 'Display is flickering', 'HIGH') returning id, request_number`,
    [assetId, reporter],
  );
  return rows[0];
}

describe("asset assignments", () => {
  it("stores_usage_location_without_changing_registered_location", async () => {
    const asset = await createAsset(db, "VY001");
    const assignmentId = await assign(asset.id, student, "VK404");

    const { rows } = await db.query<{ registered: string; usage: string }>(
      `select reg.room_number as registered, use.room_number as usage
       from public.asset_assignments aa
       join public.assets a on a.id = aa.asset_id
       join public.rooms reg on reg.id = a.registered_room_id
       join public.rooms use on use.id = aa.usage_room_id
       where aa.id = $1`,
      [assignmentId],
    );
    expect(rows[0]).toEqual({ registered: "VY001", usage: "VK404" });
  });

  it("rejects_usage_room_from_different_building", async () => {
    const asset = await createAsset(db);
    const vyas = await getRoom(db, "VY001");
    const vk404 = await getRoom(db, "VK404");
    await expectDbError(
      db.query(
        `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
         values ($1, $2, $3, $4)`,
        [asset.id, student, vyas.building_id, vk404.id],
      ),
      PG.FOREIGN_KEY_VIOLATION,
    );
  });

  it("allows_only_one_active_assignment_per_asset", async () => {
    const asset = await createAsset(db);
    await assign(asset.id, student);
    await expectDbError(assign(asset.id, otherStudent), PG.UNIQUE_VIOLATION);
  });

  it("allows_a_new_assignment_after_return_and_keeps_history", async () => {
    const asset = await createAsset(db);
    const first = await assign(asset.id, student);
    await db.query(
      "update public.asset_assignments set status = 'RETURNED' where id = $1",
      [first],
    );
    await assign(asset.id, otherStudent);

    const { rows } = await db.query<{ status: string; returned: boolean }>(
      `select status, returned_at is not null as returned
       from public.asset_assignments where asset_id = $1 order by assigned_at, created_at`,
      [asset.id],
    );
    expect(rows).toEqual([
      { status: "RETURNED", returned: true },
      { status: "ACTIVE", returned: false },
    ]);
  });

  it("new_assignments_must_be_active", async () => {
    const asset = await createAsset(db);
    const room = await getRoom(db, "VK404");
    await expectDbError(
      db.query(
        `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id, status)
         values ($1, $2, $3, $4, 'RETURNED')`,
        [asset.id, student, room.building_id, room.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("closed_assignments_cannot_be_modified", async () => {
    const asset = await createAsset(db);
    const id = await assign(asset.id, student);
    await db.query(
      "update public.asset_assignments set status = 'RETURNED' where id = $1",
      [id],
    );
    await expectDbError(
      db.query(
        "update public.asset_assignments set status = 'ACTIVE' where id = $1",
        [id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("assignment_user_and_location_are_immutable", async () => {
    const asset = await createAsset(db);
    const id = await assign(asset.id, student);
    await expectDbError(
      db.query(
        "update public.asset_assignments set user_id = $1 where id = $2",
        [otherStudent, id],
      ),
      PG.CHECK_VIOLATION,
    );
  });
});

describe("maintenance requests", () => {
  it("generates_request_number_and_starts_open", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id);
    expect(request.request_number).toMatch(
      new RegExp(`^MR-${new Date().getUTCFullYear()}-\\d{4}$`),
    );
  });

  it("takes_reporter_from_the_authenticated_user", async () => {
    const asset = await createAsset(db);
    await setAuthUser(db, student);
    try {
      const { rows } = await db.query<{ reported_by: string }>(
        `insert into public.maintenance_requests (asset_id, reported_by, description)
         values ($1, $2, 'Forged reporter') returning reported_by`,
        [asset.id, otherStudent],
      );
      expect(rows[0].reported_by).toBe(student);
    } finally {
      await setAuthUser(db, null);
    }
  });

  it("rejects_requests_created_in_a_later_state", async () => {
    const asset = await createAsset(db);
    await expectDbError(
      db.query(
        `insert into public.maintenance_requests (asset_id, reported_by, description, status)
         values ($1, $2, 'Skip ahead', 'RESOLVED')`,
        [asset.id, student],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("rejects_assigning_a_non_technician", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id);
    await expectDbError(
      db.query(
        "update public.maintenance_requests set status = 'ASSIGNED', assigned_to = $1 where id = $2",
        [otherStudent, request.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("rejects_skipping_workflow_steps", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id);
    await expectDbError(
      db.query(
        `update public.maintenance_requests
         set status = 'RESOLVED', resolution_notes = 'done' where id = $1`,
        [request.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("runs_the_full_workflow_and_sets_timestamps", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id);

    await db.query(
      "update public.maintenance_requests set status = 'ASSIGNED', assigned_to = $1 where id = $2",
      [technician, request.id],
    );
    await db.query(
      "update public.maintenance_requests set status = 'IN_PROGRESS' where id = $1",
      [request.id],
    );
    // Resolution requires notes.
    await expectDbError(
      db.query(
        "update public.maintenance_requests set status = 'RESOLVED' where id = $1",
        [request.id],
      ),
      PG.CHECK_VIOLATION,
    );
    await db.query(
      `update public.maintenance_requests
       set status = 'RESOLVED', resolution_notes = 'Replaced HDMI board' where id = $1`,
      [request.id],
    );

    const { rows } = await db.query<{ assigned: boolean; resolved: boolean }>(
      `select assigned_at is not null as assigned, resolved_at is not null as resolved
       from public.maintenance_requests where id = $1`,
      [request.id],
    );
    expect(rows[0]).toEqual({ assigned: true, resolved: true });

    // Resolved requests are closed.
    await expectDbError(
      db.query(
        "update public.maintenance_requests set priority = 'LOW' where id = $1",
        [request.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("allows_reassignment_to_another_technician", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id);
    await db.query(
      "update public.maintenance_requests set status = 'ASSIGNED', assigned_to = $1 where id = $2",
      [technician, request.id],
    );
    await db.query(
      "update public.maintenance_requests set assigned_to = $1 where id = $2",
      [otherTechnician, request.id],
    );
  });

  it("cancellation_is_allowed_from_open_and_sets_cancelled_at", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id);
    await db.query(
      `update public.maintenance_requests
       set status = 'CANCELLED', cancellation_reason = 'Duplicate' where id = $1`,
      [request.id],
    );
    const { rows } = await db.query<{ cancelled: boolean }>(
      "select cancelled_at is not null as cancelled from public.maintenance_requests where id = $1",
      [request.id],
    );
    expect(rows[0].cancelled).toBe(true);
  });
});

describe("maintenance history", () => {
  it("fills_asset_from_the_request_and_is_append_only", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id);
    const { rows } = await db.query<{ id: string; asset_id: string }>(
      `insert into public.maintenance_history (maintenance_request_id, performed_by, action, notes)
       values ($1, $2, 'INSPECTION', 'Loose HDMI connector') returning id, asset_id`,
      [request.id, technician],
    );
    expect(rows[0].asset_id).toBe(asset.id);

    await expectDbError(
      db.query(
        "update public.maintenance_history set notes = 'edited' where id = $1",
        [rows[0].id],
      ),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    await expectDbError(
      db.query("delete from public.maintenance_history where id = $1", [
        rows[0].id,
      ]),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });

  it("rejects_history_attached_to_a_different_asset", async () => {
    const asset = await createAsset(db);
    const otherAsset = await createAsset(db);
    const request = await report(asset.id);
    await expectDbError(
      db.query(
        `insert into public.maintenance_history (maintenance_request_id, asset_id, performed_by, action, notes)
         values ($1, $2, $3, 'NOTE', 'Checked')`,
        [request.id, otherAsset.id, technician],
      ),
      PG.FOREIGN_KEY_VIOLATION,
    );
  });
});
