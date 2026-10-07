import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  createAsset,
  createTestDatabase,
  createUser,
  expectDbError,
  PG,
  putStorageObject,
  setAuthUser,
} from "./helpers";

let db: PGlite;
let admin: string;
let technician: string;
let student: string;

beforeAll(async () => {
  db = await createTestDatabase();
  admin = await createUser(db, "admin@test", "ADMIN");
  technician = await createUser(db, "tech@test", "TECHNICIAN");
  student = await createUser(db, "student@test", "STUDENT");
});

async function report(assetId: string) {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.maintenance_requests (asset_id, reported_by, description)
     values ($1, $2, 'Broken') returning id`,
    [assetId, student],
  );
  return rows[0].id;
}

type DocumentInput = {
  assetId?: string | null;
  requestId?: string | null;
  bucket: string;
  path: string;
  mime: string;
  size?: number;
  type: string;
};

/** Stores the file (as uploaded), then registers its metadata. */
async function insertDocument(input: DocumentInput) {
  await putStorageObject(db, {
    bucket: input.bucket,
    path: input.path,
    mime: input.mime,
    size: input.size ?? 1024,
  });
  return db.query<{ asset_id: string }>(
    `insert into public.asset_documents
       (asset_id, maintenance_request_id, uploaded_by, bucket_name, storage_path,
        original_filename, mime_type, file_size_bytes, document_type)
     values ($1, $2, $3, $4, $5, 'file', $6, $7, $8)
     returning asset_id`,
    [
      input.assetId ?? null,
      input.requestId ?? null,
      technician,
      input.bucket,
      input.path,
      input.mime,
      input.size ?? 1024,
      input.type,
    ],
  );
}

describe("asset documents", () => {
  it("accepts_an_asset_image", async () => {
    const asset = await createAsset(db);
    await insertDocument({
      assetId: asset.id,
      bucket: "asset-images",
      path: `assets/${asset.id}/${crypto.randomUUID()}.webp`,
      mime: "image/webp",
      type: "ASSET_IMAGE",
    });
  });

  it("fills_asset_for_maintenance_evidence", async () => {
    const asset = await createAsset(db);
    const requestId = await report(asset.id);
    const { rows } = await insertDocument({
      requestId,
      bucket: "maintenance-images",
      path: `maintenance/${requestId}/${crypto.randomUUID()}.jpg`,
      mime: "image/jpeg",
      type: "MAINTENANCE_IMAGE",
    });
    expect(rows[0].asset_id).toBe(asset.id);
  });

  it("rejects_evidence_linked_to_another_assets_request", async () => {
    const asset = await createAsset(db);
    const otherAsset = await createAsset(db);
    const requestId = await report(otherAsset.id);
    await expectDbError(
      insertDocument({
        assetId: asset.id,
        requestId,
        bucket: "maintenance-documents",
        path: `maintenance/${requestId}/${crypto.randomUUID()}.pdf`,
        mime: "application/pdf",
        type: "SERVICE_REPORT",
      }),
      PG.FOREIGN_KEY_VIOLATION,
    );
  });

  it.each([
    ["executable mime type", { mime: "application/x-msdownload" }],
    ["oversized file", { size: 10 * 1024 * 1024 + 1 }],
    ["path traversal", { path: "assets/../../etc/passwd.webp" }],
    ["absolute path", { path: "/assets/x.webp" }],
    ["pdf in the image bucket", { mime: "application/pdf" }],
    ["unknown bucket", { bucket: "public-dump" }],
  ])("rejects_%s", async (_label, override) => {
    const asset = await createAsset(db);
    await expectDbError(
      insertDocument({
        assetId: asset.id,
        bucket: "asset-images",
        path: `assets/${asset.id}/${crypto.randomUUID()}.webp`,
        mime: "image/webp",
        type: "ASSET_IMAGE",
        ...override,
      }),
      PG.CHECK_VIOLATION,
    );
  });
});

describe("audit logs", () => {
  it("takes_actor_from_the_authenticated_user_and_is_append_only", async () => {
    await setAuthUser(db, student);
    let id: string;
    try {
      const { rows } = await db.query<{ id: string; actor_id: string }>(
        `insert into public.audit_logs (actor_id, action, entity_type)
         values ($1, 'ASSET_RETIRED', 'asset') returning id, actor_id`,
        [admin],
      );
      expect(rows[0].actor_id).toBe(student);
      id = rows[0].id;
    } finally {
      await setAuthUser(db, null);
    }

    await expectDbError(
      db.query(
        "update public.audit_logs set action = 'ASSET_CREATED' where id = $1",
        [id],
      ),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    await expectDbError(
      db.query("delete from public.audit_logs where id = $1", [id]),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });

  it("rejects_malformed_actions_and_entity_types", async () => {
    await expectDbError(
      db.query(
        "insert into public.audit_logs (action, entity_type) values ('drop table', 'asset')",
      ),
      PG.CHECK_VIOLATION,
    );
    await expectDbError(
      db.query(
        "insert into public.audit_logs (action, entity_type) values ('ASSET_CREATED', 'x')",
      ),
      PG.CHECK_VIOLATION,
    );
  });
});

describe("row level security", () => {
  it("is_enabled_on_every_public_table", async () => {
    const { rows } = await db.query<{ table_name: string; rls: boolean }>(
      `select c.relname as table_name, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by 1`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "asset_assignments",
      "asset_documents",
      "assets",
      "audit_logs",
      "buildings",
      "maintenance_history",
      "maintenance_requests",
      "notifications",
      "profiles",
      "rooms",
    ]);
    expect(rows.every((r) => r.rls)).toBe(true);
  });

  it("denies_a_request_without_a_profile_session", async () => {
    await db.exec("set role authenticated");
    try {
      const { rows } = await db.query<{ count: number }>(
        "select count(*)::int as count from public.assets",
      );
      expect(rows[0].count).toBe(0);
      await expectDbError(
        db.query(
          "insert into public.audit_logs (action, entity_type) values ('FAKE_EVENT', 'asset')",
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    } finally {
      await db.exec("reset role");
    }
  });

  it("does_not_expose_private_helper_functions", async () => {
    await db.exec("set role anon");
    try {
      await expectDbError(
        db.query("select private.format_reference('X', 1, 1)"),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    } finally {
      await db.exec("reset role");
    }
  });
});
