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
  putStorageObject,
} from "./helpers";

// Fixture data is created as the database owner, then every test acts through
// asUser(), i.e. exactly as a PostgREST request would.

let db: PGlite;
const users = {} as Record<
  "admin" | "techA" | "techB" | "studentA" | "studentB" | "staff" | "inactive",
  string
>;
let asset: { id: string; public_id: string };
let requestA: string; // reported by studentA, IN_PROGRESS with techA
let requestB: string; // reported by studentB, OPEN
let assignmentA: string;
let assignmentB: string;

async function count(sql: string, params: unknown[] = []) {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from (${sql}) q`,
    params,
  );
  return rows[0].n;
}

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.techA = await createUser(db, "techa@test", "TECHNICIAN");
  users.techB = await createUser(db, "techb@test", "TECHNICIAN");
  users.studentA = await createUser(db, "studenta@test", "STUDENT");
  users.studentB = await createUser(db, "studentb@test", "STUDENT");
  users.staff = await createUser(db, "staff@test", "STAFF");
  users.inactive = await createUser(db, "inactive@test", "STUDENT");
  await db.query("update public.profiles set is_active = false where id = $1", [
    users.inactive,
  ]);

  asset = await createAsset(db, "VY001");
  const otherAsset = await createAsset(db, "VY101");
  const room = await getRoom(db, "VK404");

  const insertAssignment = async (assetId: string, userId: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
         values ($1, $2, $3, $4) returning id`,
        [assetId, userId, room.building_id, room.id],
      )
    ).rows[0].id;
  assignmentA = await insertAssignment(asset.id, users.studentA);
  assignmentB = await insertAssignment(otherAsset.id, users.studentB);

  const insertRequest = async (assetId: string, reporter: string) =>
    (
      await db.query<{ id: string }>(
        `insert into public.maintenance_requests (asset_id, reported_by, description)
         values ($1, $2, 'Problem') returning id`,
        [assetId, reporter],
      )
    ).rows[0].id;
  requestA = await insertRequest(asset.id, users.studentA);
  requestB = await insertRequest(otherAsset.id, users.studentB);
  await db.query(
    "update public.maintenance_requests set status = 'ASSIGNED', assigned_to = $1 where id = $2",
    [users.techA, requestA],
  );
  await db.query(
    "update public.maintenance_requests set status = 'IN_PROGRESS' where id = $1",
    [requestA],
  );

  await db.query(
    `insert into public.maintenance_history (maintenance_request_id, performed_by, action, notes)
     values ($1, $2, 'DIAGNOSIS', 'Internal note')`,
    [requestA, users.techA],
  );
  await putStorageObject(db, {
    bucket: "maintenance-documents",
    path: `maintenance/${requestA}/report.pdf`,
    mime: "application/pdf",
    size: 2048,
  });
  await db.query(
    `insert into public.asset_documents (maintenance_request_id, uploaded_by, bucket_name,
       storage_path, original_filename, mime_type, file_size_bytes, document_type)
     values ($1, $2, 'maintenance-documents', $3, 'report.pdf', 'application/pdf', 2048, 'SERVICE_REPORT')`,
    [requestA, users.techA, `maintenance/${requestA}/report.pdf`],
  );
  await db.query(
    "insert into public.audit_logs (actor_id, action, entity_type) values ($1, 'ASSET_CREATED', 'asset')",
    [users.admin],
  );
});

// ---------------------------------------------------------------------------

describe("anonymous (public QR visitor)", () => {
  it.each([
    "profiles",
    "buildings",
    "rooms",
    "assets",
    "asset_assignments",
    "maintenance_requests",
    "maintenance_history",
    "asset_documents",
    "audit_logs",
  ])("cannot_read_%s_directly", async (table) => {
    await asUser(db, null, () =>
      expectDbError(
        db.query(`select * from public.${table}`),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("can_read_only_safe_fields_of_one_asset_by_public_id", async () => {
    const { rows } = await asUser(db, null, () =>
      db.query<Record<string, unknown>>(
        "select * from public.get_public_asset($1)",
        [asset.public_id],
      ),
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(
      [
        "asset_id",
        "building_code",
        "building_name",
        "category",
        "department",
        "name",
        "public_id",
        "room_name",
        "room_number",
        "status",
      ].sort(),
    );
    expect(rows[0]).toMatchObject({
      public_id: asset.public_id,
      room_number: "VY001",
    });
  });

  it("gets_no_rows_for_an_unknown_public_id", async () => {
    const { rows } = await asUser(db, null, () =>
      db.query("select * from public.get_public_asset('DOES-NOT-EXIST')"),
    );
    expect(rows).toHaveLength(0);
  });

  it("cannot_report_maintenance", async () => {
    await asUser(db, null, async () => {
      await expectDbError(
        db.query(
          "insert into public.maintenance_requests (asset_id, description) values ($1, 'x')",
          [asset.id],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query("select public.report_problem($1, 'x', 'LOW')", [asset.id]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query("select * from public.list_open_maintenance($1)", [asset.id]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("cannot_call_admin_functions", async () => {
    await asUser(db, null, () =>
      expectDbError(
        db.query("select public.change_user_role($1, 'ADMIN')", [
          users.studentA,
        ]),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });
});

// ---------------------------------------------------------------------------

describe("student", () => {
  it("can_read_reference_data_and_assets", async () => {
    await asUser(db, users.studentA, async () => {
      expect(await count("select * from public.buildings")).toBe(2);
      expect(await count("select * from public.rooms")).toBe(6);
      expect(await count("select * from public.assets")).toBeGreaterThanOrEqual(
        11,
      );
    });
  });

  it("cannot_create_an_asset", async () => {
    const room = await getRoom(db, "VY001");
    await asUser(db, users.studentA, () =>
      expectDbError(
        db.query(
          `insert into public.assets (name, category, registered_building_id, registered_room_id)
           values ('Mine', 'Laptop', $1, $2)`,
          [room.building_id, room.id],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("cannot_change_asset_status", async () => {
    const result = await asUser(db, users.studentA, () =>
      db.query("update public.assets set status = 'LOST' where id = $1", [
        asset.id,
      ]),
    );
    expect(result.affectedRows).toBe(0);
  });

  it("cannot_create_or_modify_buildings_and_rooms", async () => {
    await asUser(db, users.studentA, async () => {
      await expectDbError(
        db.query(
          "insert into public.buildings (name, code) values ('Hack', 'HK')",
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      const result = await db.query(
        "update public.rooms set display_name = 'Mine'",
      );
      expect(result.affectedRows).toBe(0);
    });
  });

  it("sees_only_own_assignments", async () => {
    const { rows } = await asUser(db, users.studentA, () =>
      db.query<{ id: string }>("select id from public.asset_assignments"),
    );
    expect(rows.map((r) => r.id)).toEqual([assignmentA]);
  });

  it("cannot_create_an_assignment_directly", async () => {
    const room = await getRoom(db, "VK404");
    const freeAsset = await createAsset(db);
    await asUser(db, users.studentA, () =>
      expectDbError(
        db.query(
          `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
           values ($1, $2, $3, $4)`,
          [freeAsset.id, users.studentA, room.building_id, room.id],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it.each([
    ["their_own", () => assignmentA],
    ["another_users", () => assignmentB],
  ])("cannot_modify_%s_assignment_directly", async (_, id) => {
    await asUser(db, users.studentA, () =>
      expectDbError(
        db.query(
          "update public.asset_assignments set status = 'RETURNED' where id = $1",
          [id()],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("can_report_a_problem_as_themselves_only", async () => {
    const { rows } = await asUser(db, users.studentA, async () => {
      const number = await db.query<{ n: string }>(
        "select public.report_problem($1, 'Lamp flickers', 'LOW') as n",
        [asset.id],
      );
      return db.query<{ reported_by: string; status: string }>(
        "select reported_by, status from public.maintenance_requests where request_number = $1",
        [number.rows[0].n],
      );
    });
    expect(rows[0]).toEqual({ reported_by: users.studentA, status: "OPEN" });

    // Direct inserts are refused, with or without a forged reporter.
    await asUser(db, users.studentA, async () => {
      await expectDbError(
        db.query(
          "insert into public.maintenance_requests (asset_id, reported_by, description) values ($1, $2, 'x')",
          [asset.id, users.studentB],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query(
          "insert into public.maintenance_requests (asset_id, description) values ($1, 'x')",
          [asset.id],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("sees_own_maintenance_requests_but_not_others", async () => {
    const { rows } = await asUser(db, users.studentB, () =>
      db.query<{ id: string }>("select id from public.maintenance_requests"),
    );
    expect(rows.map((r) => r.id)).toEqual([requestB]);
  });

  it("cannot_update_or_resolve_own_request", async () => {
    await asUser(db, users.studentB, () =>
      expectDbError(
        db.query(
          "update public.maintenance_requests set priority = 'CRITICAL' where id = $1",
          [requestB],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("cannot_read_internal_history_or_private_documents", async () => {
    await asUser(db, users.studentA, async () => {
      expect(await count("select * from public.maintenance_history")).toBe(0);
      expect(await count("select * from public.asset_documents")).toBe(0);
    });
  });

  it("can_see_the_technician_handling_their_request_but_no_other_profiles", async () => {
    const { rows } = await asUser(db, users.studentA, () =>
      db.query<{ id: string }>("select id from public.profiles order by email"),
    );
    expect(rows.map((r) => r.id).sort()).toEqual(
      [users.studentA, users.techA].sort(),
    );
  });

  it("can_update_own_contact_details_but_not_role_or_status", async () => {
    await asUser(db, users.studentA, async () => {
      const result = await db.query(
        "update public.profiles set full_name = 'Student A' where id = $1",
        [users.studentA],
      );
      expect(result.affectedRows).toBe(1);
      await expectDbError(
        db.query("update public.profiles set role = 'ADMIN' where id = $1", [
          users.studentA,
        ]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query("update public.profiles set is_active = true where id = $1", [
          users.studentA,
        ]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("cannot_read_or_forge_audit_logs", async () => {
    await asUser(db, users.studentA, async () => {
      expect(await count("select * from public.audit_logs")).toBe(0);
      await expectDbError(
        db.query(
          "insert into public.audit_logs (actor_id, action, entity_type) values ($1, 'ASSET_RETIRED', 'asset')",
          [users.admin],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("cannot_change_roles", async () => {
    await asUser(db, users.studentA, () =>
      expectDbError(
        db.query("select public.change_user_role($1, 'ADMIN')", [
          users.studentA,
        ]),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });
});

describe("staff", () => {
  it("has_the_same_baseline_as_students", async () => {
    await asUser(db, users.staff, async () => {
      await db.query("select public.report_problem($1, 'Noisy fan', 'LOW')", [
        asset.id,
      ]);
      const { rows } = await db.query<{ reported_by: string }>(
        "select reported_by from public.maintenance_requests where description = 'Noisy fan'",
      );
      expect(rows[0].reported_by).toBe(users.staff);
      expect(await count("select * from public.asset_assignments")).toBe(0);
      expect(await count("select * from public.audit_logs")).toBe(0);
    });
  });
});

describe("inactive user", () => {
  it("can_read_own_profile_but_nothing_else", async () => {
    await asUser(db, users.inactive, async () => {
      expect(await count("select * from public.profiles")).toBe(1);
      expect(await count("select * from public.assets")).toBe(0);
      expect(await count("select * from public.buildings")).toBe(0);
    });
  });

  it("cannot_report_problems_or_edit_profile", async () => {
    await asUser(db, users.inactive, async () => {
      await expectDbError(
        db.query("select public.report_problem($1, 'x', 'LOW')", [asset.id]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      const result = await db.query(
        "update public.profiles set full_name = 'x' where id = $1",
        [users.inactive],
      );
      expect(result.affectedRows).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------

describe("technician", () => {
  it("sees_only_assigned_maintenance_requests", async () => {
    const own = await asUser(db, users.techA, () =>
      db.query<{ id: string }>("select id from public.maintenance_requests"),
    );
    expect(own.rows.map((r) => r.id)).toEqual([requestA]);

    const other = await asUser(db, users.techB, () =>
      db.query("select id from public.maintenance_requests"),
    );
    expect(other.rows).toHaveLength(0);
  });

  it("cannot_update_requests_directly", async () => {
    await asUser(db, users.techA, () =>
      expectDbError(
        db.query(
          "update public.maintenance_requests set status = 'RESOLVED', resolution_notes = 'x' where id = $1",
          [requestA],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("can_read_history_and_documents_of_assigned_requests_only", async () => {
    await asUser(db, users.techA, async () => {
      expect(await count("select * from public.maintenance_history")).toBe(1);
      expect(await count("select * from public.asset_documents")).toBe(1);
    });
    await asUser(db, users.techB, async () => {
      expect(await count("select * from public.maintenance_history")).toBe(0);
      expect(await count("select * from public.asset_documents")).toBe(0);
    });
  });

  it("can_add_work_notes_to_assigned_request", async () => {
    const { rows } = await asUser(db, users.techA, () =>
      db.query<{ performed_by: string }>(
        `insert into public.maintenance_history (maintenance_request_id, action, notes)
         values ($1, 'REPAIR', 'Replaced lamp') returning performed_by`,
        [requestA],
      ),
    );
    expect(rows[0].performed_by).toBe(users.techA);
  });

  it("cannot_add_notes_to_another_technicians_request", async () => {
    await asUser(db, users.techB, () =>
      expectDbError(
        db.query(
          "insert into public.maintenance_history (maintenance_request_id, action, notes) values ($1, 'NOTE', 'Checked')",
          [requestA],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("cannot_insert_workflow_entries_directly", async () => {
    await asUser(db, users.techA, () =>
      expectDbError(
        db.query(
          "insert into public.maintenance_history (maintenance_request_id, action) values ($1, 'RESOLVED')",
          [requestA],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("can_upload_evidence_only_for_assigned_requests", async () => {
    // The file is in storage; what is tested here is registering it.
    const stored = async () => {
      const path = `maintenance/${requestA}/${crypto.randomUUID()}.jpg`;
      await putStorageObject(db, { bucket: "maintenance-images", path });
      return path;
    };
    const insert = (path: string) =>
      db.query(
        `insert into public.asset_documents (maintenance_request_id, bucket_name, storage_path,
           original_filename, mime_type, file_size_bytes, document_type)
         values ($1, 'maintenance-images', $2, 'photo.jpg', 'image/jpeg', 4096, 'MAINTENANCE_IMAGE')`,
        [requestA, path],
      );
    const [first, second] = [await stored(), await stored()];
    await asUser(db, users.techA, () => insert(first));
    await asUser(db, users.techB, () =>
      expectDbError(insert(second), PG.INSUFFICIENT_PRIVILEGE),
    );
  });

  it("cannot_upload_asset_images_or_delete_documents", async () => {
    const path = `assets/${asset.id}/${crypto.randomUUID()}.jpg`;
    await putStorageObject(db, { bucket: "asset-images", path });
    await asUser(db, users.techA, async () => {
      await expectDbError(
        db.query(
          `insert into public.asset_documents (asset_id, bucket_name, storage_path,
             original_filename, mime_type, file_size_bytes, document_type)
           values ($1, 'asset-images', $2, 'a.jpg', 'image/jpeg', 100, 'ASSET_IMAGE')`,
          [asset.id, path],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      const result = await db.query("delete from public.asset_documents");
      expect(result.affectedRows).toBe(0);
    });
  });

  it("sees_reporters_of_assigned_requests_but_not_unrelated_profiles", async () => {
    const { rows } = await asUser(db, users.techA, () =>
      db.query<{ id: string }>("select id from public.profiles"),
    );
    expect(rows.map((r) => r.id).sort()).toEqual(
      [users.techA, users.studentA].sort(),
    );
  });

  it("cannot_create_assets_or_read_audit_logs", async () => {
    const room = await getRoom(db, "VY001");
    await asUser(db, users.techA, async () => {
      await expectDbError(
        db.query(
          `insert into public.assets (name, category, registered_building_id, registered_room_id)
           values ('T', 'Laptop', $1, $2)`,
          [room.building_id, room.id],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      expect(await count("select * from public.audit_logs")).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------

describe("admin", () => {
  it("can_manage_locations", async () => {
    await asUser(db, users.admin, async () => {
      const { rows } = await db.query<{ id: string }>(
        "insert into public.buildings (name, code) values ('Tagore', 'TG') returning id",
      );
      await db.query(
        "insert into public.rooms (building_id, room_number) values ($1, 'TG101')",
        [rows[0].id],
      );
      const result = await db.query(
        "update public.rooms set display_name = 'Lab' where room_number = 'TG101'",
      );
      expect(result.affectedRows).toBe(1);
    });
  });

  it("can_create_and_edit_assets_with_generated_ids", async () => {
    const room = await getRoom(db, "VK301");
    await asUser(db, users.admin, async () => {
      const { rows } = await db.query<{
        id: string;
        asset_id: string;
        created_by: string;
      }>(
        `insert into public.assets (name, category, registered_building_id, registered_room_id)
         values ('Admin Laptop', 'Laptop', $1, $2) returning id, asset_id, created_by`,
        [room.building_id, room.id],
      );
      expect(rows[0].asset_id).toMatch(/^AST-\d{4}-\d{5}$/);
      expect(rows[0].created_by).toBe(users.admin);

      const result = await db.query(
        "update public.assets set department = 'Physics' where id = $1",
        [rows[0].id],
      );
      expect(result.affectedRows).toBe(1);
    });
  });

  it("cannot_set_asset_identifiers_or_delete_assets", async () => {
    await asUser(db, users.admin, async () => {
      await expectDbError(
        db.query("update public.assets set public_id = 'X-123' where id = $1", [
          asset.id,
        ]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query("delete from public.assets where id = $1", [asset.id]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("can_read_all_maintenance_and_assign_technicians", async () => {
    await asUser(db, users.admin, async () => {
      expect(
        await count("select * from public.maintenance_requests"),
      ).toBeGreaterThanOrEqual(2);
      // Only through the workflow function, which records history and audit.
      await expectDbError(
        db.query(
          "update public.maintenance_requests set status = 'ASSIGNED', assigned_to = $1 where id = $2",
          [users.techB, requestB],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await db.query("select public.assign_technician($1, $2)", [
        requestB,
        users.techB,
      ]);
    });
    const { rows } = await db.query<{ assigned_to: string }>(
      "select assigned_to from public.maintenance_requests where id = $1",
      [requestB],
    );
    expect(rows[0].assigned_to).toBe(users.techB);
    await db.query(
      "update public.maintenance_requests set status = 'CANCELLED' where id = $1",
      [requestB],
    );
  });

  it("can_read_but_not_alter_audit_logs", async () => {
    await asUser(db, users.admin, async () => {
      expect(
        await count("select * from public.audit_logs"),
      ).toBeGreaterThanOrEqual(1);
      await expectDbError(
        db.query("update public.audit_logs set action = 'X_Y_Z'"),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query("delete from public.audit_logs"),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("changes_roles_through_the_audited_function", async () => {
    const target = await createUser(db, "promote@test", "STUDENT");
    await asUser(db, users.admin, () =>
      db.query("select public.change_user_role($1, 'TECHNICIAN')", [target]),
    );

    const { rows } = await db.query<{
      role: string;
      actor_id: string;
      old_values: unknown;
      new_values: unknown;
    }>(
      `select p.role, l.actor_id, l.old_values, l.new_values
       from public.profiles p
       join public.audit_logs l on l.entity_id = p.id and l.action = 'ROLE_CHANGED'
       where p.id = $1`,
      [target],
    );
    expect(rows[0]).toEqual({
      role: "TECHNICIAN",
      actor_id: users.admin,
      old_values: { role: "STUDENT" },
      new_values: { role: "TECHNICIAN" },
    });
  });

  it("cannot_change_own_role", async () => {
    await asUser(db, users.admin, () =>
      expectDbError(
        db.query("select public.change_user_role($1, 'STUDENT')", [
          users.admin,
        ]),
        PG.CHECK_VIOLATION,
      ),
    );
  });

  it("reads_every_assignment_but_changes_them_only_through_workflows", async () => {
    const room = await getRoom(db, "VK404");
    const freeAsset = await createAsset(db);
    await asUser(db, users.admin, async () => {
      expect(
        await count("select * from public.asset_assignments"),
      ).toBeGreaterThanOrEqual(2);
      await expectDbError(
        db.query(
          `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
           values ($1, $2, $3, $4)`,
          [freeAsset.id, users.staff, room.building_id, room.id],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query(
          "update public.asset_assignments set status = 'RETURNED' where id = $1",
          [assignmentA],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("cannot_demote_a_technician_with_open_work", async () => {
    await asUser(db, users.admin, () =>
      expectDbError(
        db.query("select public.change_user_role($1, 'STUDENT')", [
          users.techA,
        ]),
        PG.CHECK_VIOLATION,
      ),
    );
  });

  it("deactivating_an_account_blocks_access_and_is_audited", async () => {
    const target = await createUser(db, "leaver@test", "STUDENT");
    await asUser(db, users.admin, () =>
      db.query("select public.set_user_active($1, false)", [target]),
    );
    await asUser(db, target, async () => {
      expect(await count("select * from public.assets")).toBe(0);
    });
    expect(
      await count(
        "select 1 from public.audit_logs where action = 'ACCOUNT_DEACTIVATED' and entity_id = $1",
        [target],
      ),
    ).toBe(1);
  });
});
