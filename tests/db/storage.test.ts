import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  type DocumentType,
  FILE_EXTENSIONS,
  MAX_FILE_BYTES,
  newStoragePath,
  UPLOAD_KINDS,
} from "@/lib/storage/files";

import {
  asUser,
  createAsset,
  createTestDatabase,
  createUser,
  expectDbError,
  PG,
  putStorageObject,
} from "./helpers";

// Storage: docs/16 Phase 14, docs/09 (buckets, policies, registration),
// docs/04 §27–30. Storage policies are tested by acting on storage.objects
// as each role, exactly as the Storage service does for an API request.

let db: PGlite;
const users = {} as Record<
  "admin" | "techA" | "techB" | "student" | "inactive",
  string
>;
let asset: { id: string };
/** Assigned to technician A and IN_PROGRESS; reported by the student. */
let request: string;

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.techA = await createUser(db, "tech-a@test", "TECHNICIAN");
  users.techB = await createUser(db, "tech-b@test", "TECHNICIAN");
  users.student = await createUser(db, "student@test", "STUDENT");
  users.inactive = await createUser(db, "gone@test", "STUDENT");
  await db.query("update public.profiles set is_active = false where id = $1", [
    users.inactive,
  ]);

  asset = await createAsset(db);
  request = await requestInProgress(asset.id);
});

async function openRequest(assetId: string) {
  const { rows } = await asUser(db, users.student, () =>
    db.query<{ n: string }>(
      "select public.report_problem($1, 'No image', 'LOW') as n",
      [assetId],
    ),
  );
  const found = await db.query<{ id: string }>(
    "select id from public.maintenance_requests where request_number = $1",
    [rows[0].n],
  );
  return found.rows[0].id;
}

async function requestInProgress(assetId: string) {
  const id = await openRequest(assetId);
  await asUser(db, users.admin, () =>
    db.query("select public.assign_technician($1, $2)", [id, users.techA]),
  );
  await asUser(db, users.techA, () =>
    db.query("select public.start_maintenance($1)", [id]),
  );
  return id;
}

const file = (ext: string) => `${crypto.randomUUID()}.${ext}`;
const assetPath = (ext = "jpg", assetId = asset.id) =>
  `assets/${assetId}/${file(ext)}`;
const requestPath = (ext = "jpg", requestId = request) =>
  `maintenance/${requestId}/${file(ext)}`;

/** Uploads as the user: an INSERT into storage.objects under its policies. */
function upload(userId: string | null, bucket: string, path: string) {
  return asUser(db, userId, () =>
    db.query(
      `insert into storage.objects (bucket_id, name, owner_id, metadata)
       values ($1, $2, $3, '{"mimetype": "image/jpeg", "size": 2048}')`,
      [bucket, path, userId],
    ),
  );
}

async function canRead(userId: string | null, path: string) {
  const { rows } = await asUser(db, userId, () =>
    db.query("select 1 from storage.objects where name = $1", [path]),
  );
  return rows.length === 1;
}

async function remove(userId: string | null, path: string) {
  const result = await asUser(db, userId, () =>
    db.query("delete from storage.objects where name = $1", [path]),
  );
  return result.affectedRows ?? 0;
}

function register(
  userId: string,
  row: {
    assetId?: string;
    requestId?: string;
    bucket: string;
    path: string;
    type: string;
    mime?: string;
    size?: number;
  },
) {
  return asUser(db, userId, () =>
    db.query<{
      id: string;
      mime_type: string;
      file_size_bytes: string;
      uploaded_by: string;
    }>(
      `insert into public.asset_documents
         (asset_id, maintenance_request_id, bucket_name, storage_path,
          original_filename, mime_type, file_size_bytes, document_type)
       values ($1, $2, $3, $4, 'photo.jpg', $5, $6, $7)
       returning id, mime_type, file_size_bytes, uploaded_by`,
      [
        row.assetId ?? null,
        row.requestId ?? null,
        row.bucket,
        row.path,
        row.mime ?? "image/jpeg",
        row.size ?? 2048,
        row.type,
      ],
    ),
  );
}

// ---------------------------------------------------------------------------

describe("buckets", () => {
  it("are_private_limited_to_10_mb_and_fixed_file_types", async () => {
    const { rows } = await db.query<{
      id: string;
      public: boolean;
      file_size_limit: string;
      allowed_mime_types: string[];
    }>(
      "select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id",
    );
    const images = ["image/jpeg", "image/png", "image/webp"];
    expect(
      rows.map((r) => ({ ...r, file_size_limit: Number(r.file_size_limit) })),
    ).toEqual([
      {
        id: "asset-images",
        public: false,
        file_size_limit: 10485760,
        allowed_mime_types: images,
      },
      {
        id: "maintenance-documents",
        public: false,
        file_size_limit: 10485760,
        allowed_mime_types: ["application/pdf"],
      },
      {
        id: "maintenance-images",
        public: false,
        file_size_limit: 10485760,
        allowed_mime_types: images,
      },
    ]);
  });
});

describe("asset image storage", () => {
  it("lets_only_admins_upload", async () => {
    await upload(users.admin, "asset-images", assetPath());
    for (const who of [users.techA, users.student, users.inactive, null]) {
      await expectDbError(
        upload(who, "asset-images", assetPath()),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    }
  });

  it.each([
    ["an unknown asset", () => assetPath("jpg", crypto.randomUUID())],
    ["a file type that is not an image", () => assetPath("pdf")],
    ["an executable", () => assetPath("exe")],
    ["a nested path", () => `assets/${asset.id}/x/${file("jpg")}`],
    ["a chosen file name", () => `assets/${asset.id}/projector.jpg`],
    ["a path outside assets/", () => `other/${asset.id}/${file("jpg")}`],
  ])("rejects_%s", async (_label, path) => {
    await expectDbError(
      upload(users.admin, "asset-images", path()),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });

  it("can_be_read_by_every_active_user_but_nobody_else", async () => {
    const path = assetPath();
    await putStorageObject(db, { bucket: "asset-images", path });
    for (const who of [users.admin, users.techB, users.student]) {
      expect(await canRead(who, path)).toBe(true);
    }
    expect(await canRead(users.inactive, path)).toBe(false);
    expect(await canRead(null, path)).toBe(false);
  });
});

describe("maintenance file storage", () => {
  it("lets_the_assigned_technician_and_admins_upload_evidence", async () => {
    await upload(users.techA, "maintenance-images", requestPath("jpg"));
    await upload(users.techA, "maintenance-documents", requestPath("pdf"));
    await upload(users.admin, "maintenance-images", requestPath("png"));
  });

  it("refuses_other_technicians_the_reporter_and_anonymous_users", async () => {
    for (const who of [users.techB, users.student, null]) {
      await expectDbError(
        upload(who, "maintenance-images", requestPath()),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    }
  });

  it("keeps_each_bucket_to_its_file_types", async () => {
    await expectDbError(
      upload(users.techA, "maintenance-images", requestPath("pdf")),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    await expectDbError(
      upload(users.techA, "maintenance-documents", requestPath("jpg")),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    // An asset path is not valid in a maintenance bucket, and vice versa.
    await expectDbError(
      upload(users.admin, "maintenance-images", assetPath()),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    await expectDbError(
      upload(users.admin, "asset-images", requestPath()),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });

  it("stops_technician_uploads_before_assignment_and_after_the_request_closes", async () => {
    const open = await openRequest((await createAsset(db)).id);
    await expectDbError(
      upload(users.techA, "maintenance-images", requestPath("jpg", open)),
      PG.INSUFFICIENT_PRIVILEGE,
    );

    const closing = await requestInProgress((await createAsset(db)).id);
    await asUser(db, users.techA, () =>
      db.query("select public.resolve_maintenance($1, 'Fixed', 'AVAILABLE')", [
        closing,
      ]),
    );
    await expectDbError(
      upload(users.techA, "maintenance-images", requestPath("jpg", closing)),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    // An admin can still attach a late document (e.g. an invoice).
    await upload(
      users.admin,
      "maintenance-documents",
      requestPath("pdf", closing),
    );
  });

  it("can_be_read_only_by_admins_and_the_assigned_technician", async () => {
    const path = requestPath("pdf");
    await putStorageObject(db, { bucket: "maintenance-documents", path });
    expect(await canRead(users.admin, path)).toBe(true);
    expect(await canRead(users.techA, path)).toBe(true);
    for (const who of [users.techB, users.student, users.inactive, null]) {
      expect(await canRead(who, path)).toBe(false);
    }
  });
});

describe("changing stored files", () => {
  it("never_allows_overwriting_or_moving_an_object", async () => {
    const path = requestPath();
    await putStorageObject(db, { bucket: "maintenance-images", path });
    for (const who of [users.admin, users.techA]) {
      const result = await asUser(db, who, () =>
        db.query(
          "update storage.objects set name = name || '.bak' where name = $1",
          [path],
        ),
      );
      expect(result.affectedRows).toBe(0);
    }
  });

  it("lets_admins_delete_and_uploaders_remove_only_unregistered_uploads", async () => {
    // Registered evidence: only an admin can delete it.
    const registered = requestPath();
    await upload(users.techA, "maintenance-images", registered);
    await register(users.techA, {
      requestId: request,
      bucket: "maintenance-images",
      path: registered,
      type: "MAINTENANCE_IMAGE",
    });
    expect(await remove(users.techA, registered)).toBe(0);
    expect(await remove(users.student, registered)).toBe(0);
    expect(await remove(users.admin, registered)).toBe(1);

    // A failed registration leaves an orphan its uploader can clean up.
    const orphan = requestPath();
    await upload(users.techA, "maintenance-images", orphan);
    expect(await remove(users.techB, orphan)).toBe(0);
    expect(await remove(users.techA, orphan)).toBe(1);
  });
});

describe("registering a file", () => {
  it("takes_type_size_and_uploader_from_storage_and_the_session", async () => {
    const path = requestPath("jpg");
    await putStorageObject(db, {
      bucket: "maintenance-images",
      path,
      mime: "image/png",
      size: 4096,
    });
    const { rows } = await register(users.techA, {
      requestId: request,
      bucket: "maintenance-images",
      path,
      type: "MAINTENANCE_IMAGE",
      mime: "image/webp", // what the client claims
      size: 1,
    });
    expect(rows[0]).toMatchObject({
      mime_type: "image/png",
      uploaded_by: users.techA,
    });
    expect(Number(rows[0].file_size_bytes)).toBe(4096);
  });

  it("refuses_a_file_that_is_not_in_storage", async () => {
    await expectDbError(
      register(users.admin, {
        assetId: asset.id,
        bucket: "asset-images",
        path: assetPath(),
        type: "ASSET_IMAGE",
      }),
      "CA011",
    );
  });

  it("refuses_a_stored_file_of_the_wrong_type_or_size", async () => {
    const disguised = assetPath("jpg");
    await putStorageObject(db, {
      bucket: "asset-images",
      path: disguised,
      mime: "application/x-msdownload",
    });
    await expectDbError(
      register(users.admin, {
        assetId: asset.id,
        bucket: "asset-images",
        path: disguised,
        type: "ASSET_IMAGE",
      }),
      PG.CHECK_VIOLATION,
    );

    const huge = assetPath("jpg");
    await putStorageObject(db, {
      bucket: "asset-images",
      path: huge,
      size: 10 * 1024 * 1024 + 1,
    });
    await expectDbError(
      register(users.admin, {
        assetId: asset.id,
        bucket: "asset-images",
        path: huge,
        type: "ASSET_IMAGE",
      }),
      PG.CHECK_VIOLATION,
    );
  });

  it("refuses_a_path_that_belongs_to_another_record", async () => {
    const otherAsset = await createAsset(db);
    const otherRequest = await requestInProgress(otherAsset.id);

    const elsewhere = requestPath("jpg", otherRequest);
    await putStorageObject(db, {
      bucket: "maintenance-images",
      path: elsewhere,
    });
    await expectDbError(
      register(users.techA, {
        requestId: request,
        bucket: "maintenance-images",
        path: elsewhere,
        type: "MAINTENANCE_IMAGE",
      }),
      PG.CHECK_VIOLATION,
    );

    const otherImage = assetPath("jpg", otherAsset.id);
    await putStorageObject(db, { bucket: "asset-images", path: otherImage });
    await expectDbError(
      register(users.admin, {
        assetId: asset.id,
        bucket: "asset-images",
        path: otherImage,
        type: "ASSET_IMAGE",
      }),
      PG.CHECK_VIOLATION,
    );
  });

  it("is_refused_to_people_who_may_not_upload", async () => {
    const path = requestPath();
    await putStorageObject(db, { bucket: "maintenance-images", path });
    for (const who of [users.techB, users.student]) {
      await expectDbError(
        register(who, {
          requestId: request,
          bucket: "maintenance-images",
          path,
          type: "MAINTENANCE_IMAGE",
        }),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    }
  });

  it("audits_uploads_and_deletions_without_paths", async () => {
    const evidence = requestPath("pdf");
    await putStorageObject(db, {
      bucket: "maintenance-documents",
      path: evidence,
      mime: "application/pdf",
    });
    const { rows: doc } = await register(users.techA, {
      requestId: request,
      bucket: "maintenance-documents",
      path: evidence,
      type: "SERVICE_REPORT",
    });

    const image = assetPath("webp");
    await putStorageObject(db, {
      bucket: "asset-images",
      path: image,
      mime: "image/webp",
    });
    const { rows: photo } = await register(users.admin, {
      assetId: asset.id,
      bucket: "asset-images",
      path: image,
      type: "ASSET_IMAGE",
    });

    // Only an admin can delete metadata.
    const byTech = await asUser(db, users.techA, () =>
      db.query("delete from public.asset_documents where id = $1", [doc[0].id]),
    );
    expect(byTech.affectedRows).toBe(0);
    await asUser(db, users.admin, () =>
      db.query("delete from public.asset_documents where id = $1", [doc[0].id]),
    );

    const { rows: audit } = await db.query<{
      action: string;
      actor_id: string;
      metadata: Record<string, unknown>;
    }>(
      `select action, actor_id, metadata from public.audit_logs
       where metadata ->> 'document_id' in ($1, $2) or entity_id::text = $1
       order by created_at`,
      [doc[0].id, photo[0].id],
    );
    expect(audit).toEqual([
      {
        action: "MAINTENANCE_EVIDENCE_UPLOADED",
        actor_id: users.techA,
        metadata: expect.objectContaining({
          document_id: doc[0].id,
          document_type: "SERVICE_REPORT",
          file_type: "application/pdf",
        }),
      },
      {
        action: "ASSET_IMAGE_UPLOADED",
        actor_id: users.admin,
        metadata: expect.objectContaining({ document_id: photo[0].id }),
      },
      {
        action: "DOCUMENT_DELETED",
        actor_id: users.admin,
        metadata: expect.objectContaining({ document_type: "SERVICE_REPORT" }),
      },
    ]);
    expect(JSON.stringify(audit)).not.toContain("maintenance/");
  });
});

describe("the app's upload rules", () => {
  const kinds = Object.entries(UPLOAD_KINDS) as Array<
    [DocumentType, (typeof UPLOAD_KINDS)[DocumentType]]
  >;

  it("generate_paths_the_storage_policies_accept", async () => {
    for (const [type, kind] of kinds) {
      const entity = kind.folder === "assets" ? asset.id : request;
      for (const mime of kind.mimeTypes) {
        const path = newStoragePath(type, entity, mime);
        await upload(users.admin, kind.bucket, path);
        expect(path.endsWith(`.${FILE_EXTENSIONS[mime]}`)).toBe(true);
      }
    }
  });

  it("allow_the_same_types_and_size_as_the_buckets", async () => {
    const { rows } = await db.query<{
      id: string;
      file_size_limit: string;
      allowed_mime_types: string[];
    }>("select id, file_size_limit, allowed_mime_types from storage.buckets");
    for (const bucket of rows) {
      const fromApp = new Set(
        kinds
          .filter(([, kind]) => kind.bucket === bucket.id)
          .flatMap(([, kind]) => [...kind.mimeTypes]),
      );
      expect([...fromApp].sort(), bucket.id).toEqual(
        [...bucket.allowed_mime_types].sort(),
      );
      expect(Number(bucket.file_size_limit)).toBe(MAX_FILE_BYTES);
    }
    expect(rows).toHaveLength(3);
  });
});

describe("storage helper privileges", () => {
  it("exposes_only_the_registration_check_to_signed_in_users", async () => {
    const { rows } = await db.query<{
      registered: boolean;
      anon: boolean;
      audit: boolean;
    }>(
      `select
         has_function_privilege('authenticated', 'private.document_registered(text, text)', 'execute') as registered,
         has_function_privilege('anon', 'private.document_registered(text, text)', 'execute') as anon,
         has_function_privilege('authenticated', 'private.asset_documents_audit()', 'execute') as audit`,
    );
    expect(rows[0]).toEqual({ registered: true, anon: false, audit: false });
  });
});
