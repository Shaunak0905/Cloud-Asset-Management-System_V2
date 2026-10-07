import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
} from "@/lib/audit/events";
import { Constants } from "@/types/database";

import {
  asUser,
  createTestDatabase,
  createUser,
  getRoom,
  putStorageObject,
} from "./helpers";

// Audit logging: docs/16 Phase 16, docs/13 §55–56 (every important operation
// leaves an audit event, attributed to the signed-in user).

const MIGRATIONS = path.resolve(
  import.meta.dirname,
  "../../supabase/migrations",
);

let db: PGlite;
const users = {} as Record<
  "admin" | "tech" | "student" | "staff" | "spare",
  string
>;

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.tech = await createUser(db, "tech@test", "TECHNICIAN");
  users.student = await createUser(db, "student@test", "STUDENT");
  users.staff = await createUser(db, "staff@test", "STAFF");
  users.spare = await createUser(db, "spare@test", "STUDENT");
});

describe("audit event names", () => {
  it("match_exactly_what_the_migrations_write", async () => {
    // Multi-word UPPER_CASE strings in the SQL are audit actions, apart from
    // enum values (e.g. IN_MAINTENANCE, SERVICE_REPORT) and notification
    // types (taken from the notifications table's own constraint).
    const { rows: constraint } = await db.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition from pg_constraint
       where conname = 'notifications_type_valid'`,
    );
    const notificationTypes = [
      ...constraint[0].definition.matchAll(/'([A-Z_]+)'/g),
    ].map(([, type]) => type);
    expect(notificationTypes.length).toBeGreaterThan(0);
    const enumValues = new Set<string>([
      ...Object.values(Constants.public.Enums).flat(),
      ...notificationTypes,
    ]);
    const written = new Set<string>();
    for (const file of readdirSync(MIGRATIONS).filter((f) =>
      f.endsWith(".sql"),
    )) {
      const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
      for (const [, token] of sql.matchAll(/'([A-Z]+(?:_[A-Z]+)+)'/g)) {
        if (!enumValues.has(token)) written.add(token);
      }
    }
    expect([...written].sort()).toEqual([...AUDIT_ACTIONS].sort());
  });

  it("cover_exactly_the_entity_types_the_table_allows", async () => {
    const { rows } = await db.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition from pg_constraint
       where conname = 'audit_logs_entity_type_valid'`,
    );
    const allowed = [...rows[0].definition.matchAll(/'([a-z_]+)'/g)].map(
      ([, type]) => type,
    );
    expect(allowed.sort()).toEqual([...AUDIT_ENTITY_TYPES].sort());
  });
});

// ---------------------------------------------------------------------------

async function call(userId: string, sql: string, params: unknown[] = []) {
  return asUser(db, userId, () =>
    db.query<Record<string, string>>(sql, params),
  );
}

describe("every audited operation", () => {
  it("records_its_event_with_the_signed_in_user_as_actor", async () => {
    const vy101 = await getRoom(db, "VY101");
    const vk404 = await getRoom(db, "VK404");
    const startedAt = (
      await db.query<{ now: string }>("select now()::text as now")
    ).rows[0].now;

    // Assets (admin): create, edit, move home, change status, retire.
    const created = await call(
      users.admin,
      `insert into public.assets (name, category, registered_building_id, registered_room_id)
       values ('Audit Projector', 'Projector', $1, $2) returning id`,
      [vy101.building_id, vy101.id],
    );
    const assetId = created.rows[0].id;
    await call(
      users.admin,
      "update public.assets set name = 'Audit Projector 2' where id = $1",
      [assetId],
    );
    await call(
      users.admin,
      "update public.assets set registered_building_id = $1, registered_room_id = $2 where id = $3",
      [vk404.building_id, vk404.id, assetId],
    );
    await call(
      users.admin,
      "update public.assets set status = 'DAMAGED' where id = $1",
      [assetId],
    );
    await call(
      users.admin,
      "update public.assets set status = 'AVAILABLE' where id = $1",
      [assetId],
    );
    const retiring = await call(
      users.admin,
      `insert into public.assets (name, category, registered_building_id, registered_room_id)
       values ('Old Laptop', 'Laptop', $1, $2) returning id`,
      [vy101.building_id, vy101.id],
    );
    await call(
      users.admin,
      "update public.assets set status = 'RETIRED' where id = $1",
      [retiring.rows[0].id],
    );

    // Assignments: request (student), transfer (admin), return (new holder).
    const requested = await call(
      users.student,
      "select public.request_asset($1, $2, $3) as id",
      [assetId, vk404.building_id, vk404.id],
    );
    const transferred = await call(
      users.admin,
      "select public.transfer_asset($1, $2, $3, $4) as id",
      [requested.rows[0].id, users.staff, vk404.building_id, vk404.id],
    );
    await call(users.staff, "select public.return_asset($1)", [
      transferred.rows[0].id,
    ]);

    // Maintenance: report, assign, start, note, evidence, resolve; cancel.
    const reported = await call(
      users.student,
      "select public.report_problem($1, 'No image', 'LOW') as n",
      [assetId],
    );
    const request = (
      await db.query<{ id: string }>(
        "select id from public.maintenance_requests where request_number = $1",
        [reported.rows[0].n],
      )
    ).rows[0].id;
    await call(users.admin, "select public.assign_technician($1, $2)", [
      request,
      users.tech,
    ]);
    await call(users.tech, "select public.start_maintenance($1)", [request]);
    await call(
      users.tech,
      `insert into public.maintenance_history (maintenance_request_id, action, notes)
       values ($1, 'REPAIR', 'Reseated the cable')`,
      [request],
    );
    const evidencePath = `maintenance/${request}/${crypto.randomUUID()}.pdf`;
    await putStorageObject(db, {
      bucket: "maintenance-documents",
      path: evidencePath,
      mime: "application/pdf",
    });
    await call(
      users.tech,
      `insert into public.asset_documents (maintenance_request_id, bucket_name, storage_path,
         original_filename, mime_type, file_size_bytes, document_type)
       values ($1, 'maintenance-documents', $2, 'report.pdf', 'application/pdf', 1024, 'SERVICE_REPORT')`,
      [request, evidencePath],
    );
    await call(
      users.tech,
      "select public.resolve_maintenance($1, 'Fixed', 'AVAILABLE')",
      [request],
    );
    const duplicate = await call(
      users.staff,
      "select public.report_problem($1, 'Same issue', 'LOW') as n",
      [assetId],
    );
    const duplicateId = (
      await db.query<{ id: string }>(
        "select id from public.maintenance_requests where request_number = $1",
        [duplicate.rows[0].n],
      )
    ).rows[0].id;
    await call(
      users.admin,
      "select public.cancel_maintenance($1, 'Duplicate')",
      [duplicateId],
    );

    // Files (admin): asset photo, then delete it.
    const photoPath = `assets/${assetId}/${crypto.randomUUID()}.jpg`;
    await putStorageObject(db, { bucket: "asset-images", path: photoPath });
    const photo = await call(
      users.admin,
      `insert into public.asset_documents (asset_id, bucket_name, storage_path,
         original_filename, mime_type, file_size_bytes, document_type)
       values ($1, 'asset-images', $2, 'front.jpg', 'image/jpeg', 1024, 'ASSET_IMAGE') returning id`,
      [assetId, photoPath],
    );
    await call(
      users.admin,
      "delete from public.asset_documents where id = $1",
      [photo.rows[0].id],
    );

    // Accounts (admin).
    await call(users.admin, "select public.change_user_role($1, 'STAFF')", [
      users.spare,
    ]);
    await call(users.admin, "select public.set_user_active($1, false)", [
      users.spare,
    ]);
    await call(users.admin, "select public.set_user_active($1, true)", [
      users.spare,
    ]);

    const { rows } = await db.query<{
      action: AuditAction;
      actor_id: string | null;
    }>(
      "select action, actor_id from public.audit_logs where created_at >= $1::timestamptz",
      [startedAt],
    );

    // Every known event happened, and nothing unknown was written.
    expect([...new Set(rows.map((r) => r.action))].sort()).toEqual(
      [...AUDIT_ACTIONS].sort(),
    );
    // No event is anonymous: the actor always comes from the session.
    expect(rows.filter((r) => r.actor_id === null)).toEqual([]);

    const actorsOf = (action: AuditAction) =>
      new Set(rows.filter((r) => r.action === action).map((r) => r.actor_id));
    expect(actorsOf("ASSET_CREATED")).toContain(users.admin);
    expect(actorsOf("ASSET_ASSIGNED")).toEqual(new Set([users.student]));
    expect(actorsOf("ASSET_RETURNED")).toEqual(new Set([users.staff]));
    expect(actorsOf("MAINTENANCE_STARTED")).toEqual(new Set([users.tech]));
    expect(actorsOf("MAINTENANCE_EVIDENCE_UPLOADED")).toEqual(
      new Set([users.tech]),
    );
    expect(actorsOf("MAINTENANCE_RESOLVED")).toEqual(new Set([users.tech]));
    expect(actorsOf("ROLE_CHANGED")).toEqual(new Set([users.admin]));
  });
});

describe("reading the audit log", () => {
  it("is_for_admins_only", async () => {
    const count = async (userId: string) =>
      (
        await asUser(db, userId, () =>
          db.query("select 1 from public.audit_logs limit 5"),
        )
      ).rows.length;
    expect(await count(users.admin)).toBeGreaterThan(0);
    for (const who of [users.tech, users.student, users.staff]) {
      expect(await count(who)).toBe(0);
    }
  });
});
