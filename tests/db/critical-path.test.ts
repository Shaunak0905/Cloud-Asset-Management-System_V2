import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  asUser,
  createTestDatabase,
  createUser,
  expectDbError,
  getRoom,
  PG,
} from "./helpers";

// The critical end-to-end scenarios of docs/14 §57–60, run through the real
// workflow functions in order, each step as the role that performs it in the
// app (exactly what the app's server actions call). One shared database: the
// steps build on each other, like a person using the system.

let db: PGlite;
const users = {} as Record<
  "admin" | "technician" | "otherTechnician" | "student" | "otherStudent",
  string
>;

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.technician = await createUser(db, "technician@test", "TECHNICIAN");
  users.otherTechnician = await createUser(db, "tech2@test", "TECHNICIAN");
  users.student = await createUser(db, "student@test", "STUDENT");
  users.otherStudent = await createUser(db, "student2@test", "STUDENT");
});

async function one<T>(
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T> {
  const { rows } = await asUser(db, userId, () => db.query<T>(sql, params));
  return rows[0];
}

async function assetState(id: string) {
  const { rows } = await db.query<{
    status: string;
    building: string;
    room: string;
  }>(
    `select a.status, b.name as building, r.room_number as room
     from public.assets a
     join public.buildings b on b.id = a.registered_building_id
     join public.rooms r on r.id = a.registered_room_id
     where a.id = $1`,
    [id],
  );
  return rows[0];
}

describe("critical workflow (docs/14 §58)", () => {
  // Filled in as the scenario runs.
  const asset = {} as { id: string; assetId: string; publicId: string };
  const request = {} as { id: string; number: string };
  let assignment: string;

  it("1_admin_creates_an_asset_registered_at_vyas_vy001", async () => {
    const home = await getRoom(db, "VY001");
    const created = await one<{
      id: string;
      asset_id: string;
      public_id: string;
    }>(
      users.admin,
      `insert into public.assets (name, category, department, registered_building_id, registered_room_id)
       values ('E2E Projector', 'Projector', 'Physics', $1, $2)
       returning id, asset_id, public_id`,
      [home.building_id, home.id],
    );
    Object.assign(asset, {
      id: created.id,
      assetId: created.asset_id,
      publicId: created.public_id,
    });
    expect(asset.assetId).toMatch(/^AST-\d{4}-\d{5,}$/);
    expect(await assetState(asset.id)).toEqual({
      status: "AVAILABLE",
      building: "Vyas",
      room: "VY001",
    });
  });

  it("2_anyone_scanning_the_qr_sees_only_its_public_fields", async () => {
    const scanned = await one<Record<string, unknown>>(
      null,
      "select * from public.get_public_asset($1)",
      [asset.publicId],
    );
    expect(scanned).toEqual({
      public_id: asset.publicId,
      asset_id: asset.assetId,
      name: "E2E Projector",
      category: "Projector",
      status: "AVAILABLE",
      department: "Physics",
      building_name: "Vyas",
      building_code: expect.any(String),
      room_number: "VY001",
      room_name: expect.toBeOneOf([expect.any(String), null]),
    });
  });

  it("3_the_student_requests_it_for_vivekananda_vk404", async () => {
    const usage = await getRoom(db, "VK404");
    assignment = (
      await one<{ id: string }>(
        users.student,
        "select public.request_asset($1, $2, $3) as id",
        [asset.id, usage.building_id, usage.id],
      )
    ).id;

    const { rows } = await db.query<{
      status: string;
      user_id: string;
      building: string;
      room: string;
    }>(
      `select aa.status, aa.user_id, b.name as building, r.room_number as room
       from public.asset_assignments aa
       join public.buildings b on b.id = aa.usage_building_id
       join public.rooms r on r.id = aa.usage_room_id
       where aa.id = $1`,
      [assignment],
    );
    expect(rows[0]).toEqual({
      status: "ACTIVE",
      user_id: users.student,
      building: "Vivekananda",
      room: "VK404",
    });
  });

  it("4_the_asset_stays_registered_at_its_home_location", async () => {
    expect(await assetState(asset.id)).toEqual({
      status: "ASSIGNED",
      building: "Vyas",
      room: "VY001",
    });
  });

  it("5_the_student_reports_a_serious_problem", async () => {
    request.number = (
      await one<{ n: string }>(
        users.student,
        "select public.report_problem($1, 'Lamp flickers and turns off.', 'HIGH') as n",
        [asset.id],
      )
    ).n;
    expect(request.number).toMatch(/^MR-\d{4}-\d{4,}$/);
    const found = await one<{
      id: string;
      status: string;
      reported_by: string;
    }>(
      users.student,
      "select id, status, reported_by from public.maintenance_requests where request_number = $1",
      [request.number],
    );
    request.id = found.id;
    expect(found).toMatchObject({ status: "OPEN", reported_by: users.student });
  });

  it("6_returning_it_takes_it_out_of_service_until_repaired", async () => {
    await one(users.student, "select public.return_asset($1)", [assignment]);
    expect((await assetState(asset.id)).status).toBe("IN_MAINTENANCE");
  });

  it("7_the_admin_assigns_a_technician", async () => {
    await one(users.admin, "select public.assign_technician($1, $2)", [
      request.id,
      users.technician,
    ]);
    const assigned = await one<{ status: string; assigned_to: string }>(
      users.technician,
      "select status, assigned_to from public.maintenance_requests where id = $1",
      [request.id],
    );
    expect(assigned).toEqual({
      status: "ASSIGNED",
      assigned_to: users.technician,
    });
  });

  it("8_the_technician_starts_work_uploads_evidence_and_logs_the_repair", async () => {
    await one(users.technician, "select public.start_maintenance($1)", [
      request.id,
    ]);

    // Upload (an insert into storage.objects under the storage policies),
    // then register the file, as the app's uploader does.
    const path = `maintenance/${request.id}/${crypto.randomUUID()}.jpg`;
    await one(
      users.technician,
      `insert into storage.objects (bucket_id, name, owner_id, metadata)
       values ('maintenance-images', $1, $2, '{"mimetype": "image/jpeg", "size": 4096}')`,
      [path, users.technician],
    );
    const document = await one<{
      uploaded_by: string;
      file_size_bytes: string;
    }>(
      users.technician,
      `insert into public.asset_documents
         (maintenance_request_id, bucket_name, storage_path, original_filename,
          mime_type, file_size_bytes, document_type)
       values ($1, 'maintenance-images', $2, 'lamp.jpg', 'image/jpeg', 4096, 'MAINTENANCE_IMAGE')
       returning uploaded_by, file_size_bytes`,
      [request.id, path],
    );
    expect(document.uploaded_by).toBe(users.technician);

    await one(
      users.technician,
      `insert into public.maintenance_history (maintenance_request_id, action, notes)
       values ($1, 'PART_REPLACEMENT', 'Replaced the lamp.')`,
      [request.id],
    );
  });

  it("9_the_technician_resolves_it_and_the_asset_is_available_again", async () => {
    const status = await one<{ status: string }>(
      users.technician,
      "select public.resolve_maintenance($1, 'New lamp fitted and tested for an hour.', 'AVAILABLE') as status",
      [request.id],
    );
    expect(status.status).toBe("AVAILABLE");
    expect(await assetState(asset.id)).toEqual({
      status: "AVAILABLE",
      building: "Vyas",
      room: "VY001",
    });
    const resolved = await one<{ status: string; resolved_at: string | null }>(
      users.admin,
      "select status, resolved_at from public.maintenance_requests where id = $1",
      [request.id],
    );
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolved_at).not.toBeNull();
  });

  it("10_the_maintenance_history_tells_the_whole_story", async () => {
    const { rows } = await asUser(db, users.admin, () =>
      db.query<{ action: string; by: string }>(
        `select action, performed_by as by from public.maintenance_history
         where maintenance_request_id = $1 order by created_at, id`,
        [request.id],
      ),
    );
    expect(rows).toEqual([
      { action: "REPORTED", by: users.student },
      { action: "ASSIGNED", by: users.admin },
      { action: "STARTED", by: users.technician },
      { action: "PART_REPLACEMENT", by: users.technician },
      { action: "RESOLVED", by: users.technician },
    ]);
  });

  it("11_audit_events_exist_with_the_right_people_as_actors", async () => {
    const { rows } = await asUser(db, users.admin, () =>
      db.query<{ action: string; actor: string }>(
        `select action, actor_id as actor from public.audit_logs
         where entity_id in ($1, $2, $3) order by created_at, id`,
        [asset.id, assignment, request.id],
      ),
    );
    const actions = rows.map((r) => `${r.action} by ${r.actor}`);
    for (const expected of [
      `ASSET_CREATED by ${users.admin}`,
      `ASSET_ASSIGNED by ${users.student}`,
      `MAINTENANCE_CREATED by ${users.student}`,
      `ASSET_RETURNED by ${users.student}`,
      `MAINTENANCE_ASSIGNED by ${users.admin}`,
      `MAINTENANCE_STARTED by ${users.technician}`,
      `MAINTENANCE_EVIDENCE_UPLOADED by ${users.technician}`,
      `MAINTENANCE_HISTORY_ADDED by ${users.technician}`,
      `MAINTENANCE_RESOLVED by ${users.technician}`,
    ]) {
      expect(actions).toContain(expected);
    }
    // Every event was made by someone in the scenario, never left blank.
    expect(rows.every((r) => Object.values(users).includes(r.actor))).toBe(
      true,
    );
  });
});

describe("failure scenario: two people request the same asset (docs/14 §59)", () => {
  it("lets_exactly_one_succeed_and_leaves_one_active_assignment", async () => {
    const home = await getRoom(db, "VY101");
    const usage = await getRoom(db, "VK301");
    const asset = await one<{ id: string }>(
      users.admin,
      `insert into public.assets (name, category, registered_building_id, registered_room_id)
       values ('E2E Laptop', 'Laptop', $1, $2) returning id`,
      [home.building_id, home.id],
    );
    const request = (userId: string) =>
      asUser(db, userId, () =>
        db.query("select public.request_asset($1, $2, $3)", [
          asset.id,
          usage.building_id,
          usage.id,
        ]),
      );

    // The test database has one connection, so the requests run one after
    // the other; requests.test.ts covers the unique index that also settles
    // a true race between connections.
    const results = [
      await request(users.student).then(
        () => "assigned",
        () => "refused",
      ),
      await request(users.otherStudent).then(
        () => "assigned",
        (error: { code?: string }) => `refused ${error.code}`,
      ),
    ];
    expect(results).toEqual(["assigned", expect.stringMatching(/^refused/)]);

    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.asset_assignments where asset_id = $1 and status = 'ACTIVE'",
      [asset.id],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("security scenario (docs/14 §60)", () => {
  let foreignRequest: string;

  beforeAll(async () => {
    const home = await getRoom(db, "VY001");
    const asset = await one<{ id: string }>(
      users.admin,
      `insert into public.assets (name, category, registered_building_id, registered_room_id)
       values ('E2E Camera', 'Camera', $1, $2) returning id`,
      [home.building_id, home.id],
    );
    const number = (
      await one<{ n: string }>(
        users.otherStudent,
        "select public.report_problem($1, 'Lens is stuck.', 'LOW') as n",
        [asset.id],
      )
    ).n;
    foreignRequest = (
      await db.query<{ id: string }>(
        "select id from public.maintenance_requests where request_number = $1",
        [number],
      )
    ).rows[0].id;
    await one(users.admin, "select public.assign_technician($1, $2)", [
      foreignRequest,
      users.otherTechnician,
    ]);
  });

  it("a_student_cannot_read_audit_data_or_run_admin_operations", async () => {
    const audit = await asUser(db, users.student, () =>
      db.query("select 1 from public.audit_logs"),
    );
    expect(audit.rows).toEqual([]);
    await asUser(db, users.student, () =>
      expectDbError(
        db.query("select public.assign_technician($1, $2)", [
          foreignRequest,
          users.technician,
        ]),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("a_technician_cannot_see_or_work_on_another_technicians_request", async () => {
    const seen = await asUser(db, users.technician, () =>
      db.query("select 1 from public.maintenance_requests where id = $1", [
        foreignRequest,
      ]),
    );
    expect(seen.rows).toEqual([]);
    await asUser(db, users.technician, () =>
      expectDbError(
        db.query("select public.start_maintenance($1)", [foreignRequest]),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("the_public_cannot_read_private_storage_objects", async () => {
    await db.query(
      `insert into storage.objects (bucket_id, name, metadata)
       values ('maintenance-documents', $1, '{"mimetype": "application/pdf", "size": 10}')`,
      [`maintenance/${foreignRequest}/${crypto.randomUUID()}.pdf`],
    );
    const objects = await asUser(db, null, () =>
      db.query("select 1 from storage.objects"),
    );
    expect(objects.rows).toEqual([]);
  });
});
