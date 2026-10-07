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

beforeAll(async () => {
  db = await createTestDatabase();
});

const YEAR = new Date().getUTCFullYear();

describe("migrations and seed", () => {
  it("applies_all_migrations_and_loads_seed_data", async () => {
    const { rows } = await db.query<{
      buildings: number;
      rooms: number;
      assets: number;
    }>(
      `select
         (select count(*)::int from public.buildings) as buildings,
         (select count(*)::int from public.rooms) as rooms,
         (select count(*)::int from public.assets) as assets`,
    );
    expect(rows[0]).toEqual({ buildings: 2, rooms: 6, assets: 9 });
  });

  it("seed_is_idempotent", async () => {
    const seeded = await createTestDatabase();
    const { readFileSync } = await import("node:fs");
    await seeded.exec(readFileSync("supabase/seed.sql", "utf8"));
    const { rows } = await seeded.query<{ count: number }>(
      "select count(*)::int as count from public.assets",
    );
    expect(rows[0].count).toBe(9);
    await seeded.close();
  });
});

describe("profiles", () => {
  it("creates_a_student_profile_for_every_new_auth_user", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ('new.user@test', '{"full_name": "New User"}') returning id`,
    );
    const profile = await db.query<{
      full_name: string;
      role: string;
      is_active: boolean;
    }>("select full_name, role, is_active from public.profiles where id = $1", [
      rows[0].id,
    ]);
    expect(profile.rows[0]).toEqual({
      full_name: "New User",
      role: "STUDENT",
      is_active: true,
    });
  });

  it("ignores_a_role_supplied_in_user_metadata", async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data)
       values ('sneaky@test', '{"role": "ADMIN"}') returning id`,
    );
    const profile = await db.query<{ role: string; full_name: string }>(
      "select role, full_name from public.profiles where id = $1",
      [rows[0].id],
    );
    expect(profile.rows[0]).toEqual({ role: "STUDENT", full_name: "sneaky" });
  });
});

describe("buildings and rooms", () => {
  it("rejects_duplicate_room_numbers_in_the_same_building", async () => {
    const room = await getRoom(db, "VY001");
    await expectDbError(
      db.query(
        "insert into public.rooms (building_id, room_number) values ($1, 'VY001')",
        [room.building_id],
      ),
      PG.UNIQUE_VIOLATION,
    );
  });

  it("rejects_invalid_building_codes", async () => {
    await expectDbError(
      db.query(
        "insert into public.buildings (name, code) values ('Bad', 'bad code')",
      ),
      PG.CHECK_VIOLATION,
    );
  });
});

describe("assets", () => {
  it("generates_asset_id_and_uses_it_as_public_id", async () => {
    const asset = await createAsset(db);
    expect(asset.asset_id).toMatch(new RegExp(`^AST-${YEAR}-\\d{5}$`));
    expect(asset.public_id).toBe(asset.asset_id);
  });

  it("rejects_client_supplied_identifiers", async () => {
    const room = await getRoom(db, "VY001");
    await expectDbError(
      db.query(
        `insert into public.assets (asset_id, name, category, registered_building_id, registered_room_id)
         values ('AST-FAKE-1', 'X', 'Projector', $1, $2)`,
        [room.building_id, room.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("never_allows_asset_id_or_public_id_to_change", async () => {
    const asset = await createAsset(db);
    await expectDbError(
      db.query(
        "update public.assets set public_id = 'NEW-ID-123' where id = $1",
        [asset.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("rejects_room_from_different_building", async () => {
    const vyas = await getRoom(db, "VY001");
    const vk404 = await getRoom(db, "VK404");
    await expectDbError(
      db.query(
        `insert into public.assets (name, category, registered_building_id, registered_room_id)
         values ('Mismatch', 'Projector', $1, $2)`,
        [vyas.building_id, vk404.id],
      ),
      PG.FOREIGN_KEY_VIOLATION,
    );
  });

  it("rejects_unknown_categories", async () => {
    const room = await getRoom(db, "VY001");
    await expectDbError(
      db.query(
        `insert into public.assets (name, category, registered_building_id, registered_room_id)
         values ('Toaster', 'Kitchen', $1, $2)`,
        [room.building_id, room.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("rejects_warranty_before_purchase_date", async () => {
    const room = await getRoom(db, "VY001");
    await expectDbError(
      db.query(
        `insert into public.assets (name, category, registered_building_id, registered_room_id,
                                    purchase_date, warranty_until)
         values ('Dates', 'Laptop', $1, $2, '2025-01-01', '2024-01-01')`,
        [room.building_id, room.id],
      ),
      PG.CHECK_VIOLATION,
    );
  });

  it("allows_documented_status_transitions", async () => {
    const asset = await createAsset(db);
    for (const status of ["IN_MAINTENANCE", "DAMAGED", "AVAILABLE", "LOST"]) {
      await db.query("update public.assets set status = $1 where id = $2", [
        status,
        asset.id,
      ]);
    }
  });

  it("rejects_undocumented_status_transitions", async () => {
    const asset = await createAsset(db);
    await db.query("update public.assets set status = 'LOST' where id = $1", [
      asset.id,
    ]);
    await expectDbError(
      db.query("update public.assets set status = 'ASSIGNED' where id = $1", [
        asset.id,
      ]),
      PG.CHECK_VIOLATION,
    );
  });

  it("retiring_sets_archived_at_and_is_terminal", async () => {
    const asset = await createAsset(db);
    await db.query(
      "update public.assets set status = 'RETIRED' where id = $1",
      [asset.id],
    );
    const { rows } = await db.query<{ archived_at: Date | null }>(
      "select archived_at from public.assets where id = $1",
      [asset.id],
    );
    expect(rows[0].archived_at).toBeInstanceOf(Date);

    await expectDbError(
      db.query("update public.assets set status = 'AVAILABLE' where id = $1", [
        asset.id,
      ]),
      PG.CHECK_VIOLATION,
    );
  });

  it("sets_created_by_from_the_authenticated_user", async () => {
    const admin = await createUser(db, "creator.admin@test", "ADMIN");
    const impostor = await createUser(db, "impostor@test");
    const room = await getRoom(db, "VY001");

    await setAuthUser(db, admin);
    try {
      const { rows } = await db.query<{ created_by: string }>(
        `insert into public.assets (name, category, registered_building_id, registered_room_id, created_by)
         values ('Owned', 'Laptop', $1, $2, $3) returning created_by`,
        [room.building_id, room.id, impostor],
      );
      expect(rows[0].created_by).toBe(admin);
    } finally {
      await setAuthUser(db, null);
    }
  });
});
