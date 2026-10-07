import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { manualStatusTargets } from "@/lib/assets/status";
import { ASSET_CATEGORIES } from "@/lib/assets/constants";
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

let db: PGlite;
let admin: string;
let student: string;

beforeAll(async () => {
  db = await createTestDatabase();
  admin = await createUser(db, "admin@test", "ADMIN");
  student = await createUser(db, "student@test", "STUDENT");
});

async function auditFor(assetId: string) {
  const { rows } = await db.query<{
    action: string;
    actor_id: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }>(
    `select action, actor_id, old_values, new_values, metadata
     from public.audit_logs where entity_type = 'asset' and entity_id = $1
     order by created_at, action`,
    [assetId],
  );
  return rows;
}

async function adminCreatesAsset() {
  const room = await getRoom(db, "VY001");
  return asUser(db, admin, async () => {
    const { rows } = await db.query<{ id: string; asset_id: string }>(
      `insert into public.assets (name, category, registered_building_id, registered_room_id)
       values ('Audit Projector', 'Projector', $1, $2) returning id, asset_id`,
      [room.building_id, room.id],
    );
    return rows[0];
  });
}

describe("asset audit trail", () => {
  it("records_creation_with_the_signed_in_admin_as_actor", async () => {
    const asset = await adminCreatesAsset();
    const [event] = await auditFor(asset.id);
    expect(event).toMatchObject({
      action: "ASSET_CREATED",
      actor_id: admin,
      new_values: {
        asset_id: asset.asset_id,
        name: "Audit Projector",
        status: "AVAILABLE",
      },
    });
  });

  it("records_which_fields_changed", async () => {
    const asset = await adminCreatesAsset();
    await asUser(db, admin, () =>
      db.query(
        "update public.assets set name = 'Renamed', department = 'Physics' where id = $1",
        [asset.id],
      ),
    );
    const events = await auditFor(asset.id);
    expect(events.at(-1)).toMatchObject({
      action: "ASSET_UPDATED",
      actor_id: admin,
      metadata: { changed_fields: ["department", "name"] },
    });
  });

  it("records_registered_location_changes_with_readable_rooms", async () => {
    const asset = await adminCreatesAsset();
    const vk404 = await getRoom(db, "VK404");
    await asUser(db, admin, () =>
      db.query(
        "update public.assets set registered_building_id = $1, registered_room_id = $2 where id = $3",
        [vk404.building_id, vk404.id, asset.id],
      ),
    );
    const event = (await auditFor(asset.id)).find(
      (e) => e.action === "ASSET_REGISTERED_LOCATION_CHANGED",
    );
    expect(event).toMatchObject({
      old_values: { building: "VY", room: "VY001" },
      new_values: { building: "VK", room: "VK404" },
    });
  });

  it("records_status_changes_and_retirement", async () => {
    const asset = await adminCreatesAsset();
    await asUser(db, admin, async () => {
      await db.query(
        "update public.assets set status = 'DAMAGED' where id = $1",
        [asset.id],
      );
      await db.query(
        "update public.assets set status = 'RETIRED' where id = $1",
        [asset.id],
      );
    });
    const actions = (await auditFor(asset.id)).map((e) => e.action);
    expect(actions).toEqual([
      "ASSET_CREATED",
      "ASSET_STATUS_CHANGED",
      "ASSET_RETIRED",
    ]);
  });

  it("does_not_log_updates_that_change_nothing_meaningful", async () => {
    const asset = await adminCreatesAsset();
    await asUser(db, admin, () =>
      db.query("update public.assets set name = name where id = $1", [
        asset.id,
      ]),
    );
    expect((await auditFor(asset.id)).map((e) => e.action)).toEqual([
      "ASSET_CREATED",
    ]);
  });
});

describe("assigned status guard", () => {
  it("rejects_manual_changes_into_or_out_of_assigned", async () => {
    const asset = await createAsset(db);
    await asUser(db, admin, () =>
      expectDbError(
        db.query("update public.assets set status = 'ASSIGNED' where id = $1", [
          asset.id,
        ]),
        PG.CHECK_VIOLATION,
      ),
    );
  });

  it("allows_it_inside_the_assignment_workflow", async () => {
    const asset = await createAsset(db);
    await db.transaction(async (tx) => {
      await tx.query("select set_config('app.workflow', 'assignment', true)");
      await tx.query(
        "update public.assets set status = 'ASSIGNED' where id = $1",
        [asset.id],
      );
    });
    // The marker is transaction-local: outside it, leaving ASSIGNED is blocked.
    await expectDbError(
      db.query("update public.assets set status = 'AVAILABLE' where id = $1", [
        asset.id,
      ]),
      PG.CHECK_VIOLATION,
    );
  });
});

describe("list_asset_departments", () => {
  it("returns_distinct_sorted_departments_to_active_users_only", async () => {
    const { rows } = await asUser(db, student, () =>
      db.query<{ departments: string[] }>(
        "select public.list_asset_departments() as departments",
      ),
    );
    const departments = rows[0].departments;
    expect(departments).toEqual(
      expect.arrayContaining([
        "Administration",
        "Computer Science",
        "Electronics",
      ]),
    );
    expect(departments).toEqual([...new Set(departments)].sort());

    await asUser(db, null, () =>
      expectDbError(
        db.query("select public.list_asset_departments()"),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });
});

describe("application constants match the database", () => {
  it("uses_exactly_the_categories_the_check_constraint_allows", async () => {
    const { rows } = await db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint
       where conname = 'assets_category_valid'`,
    );
    const allowed = [...rows[0].def.matchAll(/'([^']+)'::text/g)].map(
      (m) => m[1],
    );
    expect([...ASSET_CATEGORIES].sort()).toEqual(allowed.sort());
  });

  it("offers_only_status_changes_the_database_accepts", async () => {
    const statuses = Constants.public.Enums.asset_status;
    for (const from of statuses) {
      for (const to of manualStatusTargets(from)) {
        const { rows } = await db.query<{ ok: boolean }>(
          "select private.asset_status_transition_allowed($1, $2) as ok",
          [from, to],
        );
        expect(rows[0].ok, `${from} -> ${to}`).toBe(true);
        expect(to).not.toBe("ASSIGNED");
      }
    }
    expect(manualStatusTargets("ASSIGNED")).toEqual([]);
  });
});
