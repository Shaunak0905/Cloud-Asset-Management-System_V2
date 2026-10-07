import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { expect } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

function readSql(file: string) {
  return readFileSync(file, "utf8");
}

/** A fresh in-memory Postgres with every migration (and optionally the seed) applied. */
export async function createTestDatabase({ seed = true } = {}) {
  const db = new PGlite();
  await db.exec(readSql(path.join(import.meta.dirname, "supabase-stub.sql")));

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    await db.exec(readSql(path.join(MIGRATIONS_DIR, file)));
  }

  if (seed) {
    await db.exec(readSql(path.join(ROOT, "supabase", "seed.sql")));
  }
  return db;
}

export type Role = "ADMIN" | "TECHNICIAN" | "STAFF" | "STUDENT";

/** Creates an auth user (the profile is created by trigger) and sets its role. */
export async function createUser(
  db: PGlite,
  email: string,
  role: Role = "STUDENT",
) {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email],
  );
  const id = rows[0].id;
  await db.query("update public.profiles set role = $1 where id = $2", [
    role,
    id,
  ]);
  return id;
}

/** Simulates a request authenticated as `userId` (null = no session). */
export async function setAuthUser(db: PGlite, userId: string | null) {
  const claims = userId
    ? JSON.stringify({ sub: userId, role: "authenticated" })
    : "";
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    claims,
  ]);
}

/**
 * Runs `fn` the way PostgREST runs an API request: as the `anon` role when
 * `userId` is null, otherwise as `authenticated` with that user's JWT claims.
 * Everything inside is subject to grants and RLS.
 */
export async function asUser<T>(
  db: PGlite,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await setAuthUser(db, userId);
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await setAuthUser(db, null);
  }
}

export async function getRoom(db: PGlite, roomNumber: string) {
  const { rows } = await db.query<{ id: string; building_id: string }>(
    "select id, building_id from public.rooms where room_number = $1",
    [roomNumber],
  );
  if (!rows[0]) throw new Error(`Seed room ${roomNumber} not found`);
  return rows[0];
}

let assetCounter = 0;

/** Inserts a new AVAILABLE asset registered in the given seed room. */
export async function createAsset(db: PGlite, roomNumber = "VY001") {
  const room = await getRoom(db, roomNumber);
  assetCounter += 1;
  const { rows } = await db.query<{
    id: string;
    asset_id: string;
    public_id: string;
  }>(
    `insert into public.assets (name, category, registered_building_id, registered_room_id)
     values ($1, 'Projector', $2, $3)
     returning id, asset_id, public_id`,
    [`Test Asset ${assetCounter}`, room.building_id, room.id],
  );
  return rows[0];
}

/**
 * Records a stored object the way Supabase Storage does after an upload
 * (bypasses storage policies; run it outside asUser).
 */
export async function putStorageObject(
  db: PGlite,
  object: {
    bucket: string;
    path: string;
    mime?: string;
    size?: number;
    owner?: string | null;
  },
) {
  await db.query(
    `insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ($1, $2, $3, $4::jsonb)`,
    [
      object.bucket,
      object.path,
      object.owner ?? null,
      JSON.stringify({
        mimetype: object.mime ?? "image/jpeg",
        size: object.size ?? 1024,
      }),
    ],
  );
}

/** Asserts the promise rejects with the given Postgres SQLSTATE code. */
export async function expectDbError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

/** SQLSTATE codes used by our constraints and triggers. */
export const PG = {
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
  NOT_NULL_VIOLATION: "23502",
  INSUFFICIENT_PRIVILEGE: "42501",
} as const;
