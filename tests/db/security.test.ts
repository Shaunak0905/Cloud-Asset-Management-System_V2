import { readFileSync } from "node:fs";
import path from "node:path";

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

// Security review checks (docs/04 §46–50, docs/16 Phase 21). The first part
// reads the system catalog, so a future migration that widens a grant,
// forgets RLS or leaves a function open to anonymous callers fails here. The
// second part attempts the unauthorized operations a crafted API request
// could try, as every role.

let db: PGlite;

async function rows<T>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = await createTestDatabase();
});

describe("database catalog", () => {
  it("passes_the_live_security_check_script", async () => {
    // supabase/setup/security-check.sql is what the developer runs on the
    // live project; on a correctly migrated database it returns no rows.
    const script = readFileSync(
      path.resolve(
        import.meta.dirname,
        "../../supabase/setup/security-check.sql",
      ),
      "utf8",
    );
    expect(await rows(script)).toEqual([]);
  });

  it("enables_row_level_security_on_every_table", async () => {
    const tables = await rows<{ name: string; rls: boolean }>(
      `select c.relname as name, c.relrowsecurity as rls
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')`,
    );
    expect(tables.length).toBeGreaterThanOrEqual(10);
    expect(tables.filter((t) => !t.rls).map((t) => t.name)).toEqual([]);
  });

  it("has_no_views_that_would_bypass_rls", async () => {
    const views = await rows(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('v', 'm')`,
    );
    expect(views).toEqual([]);
  });

  it("gives_anonymous_users_no_table_or_sequence_access", async () => {
    const grants = await rows(
      `select table_name, privilege_type from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'
       union all
       select table_name, privilege_type from information_schema.column_privileges
       where grantee = 'anon' and table_schema = 'public'`,
    );
    expect(grants).toEqual([]);

    const sequences = await rows(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'S'
         and (has_sequence_privilege('anon', c.oid, 'usage, select, update')
           or has_sequence_privilege('authenticated', c.oid, 'usage, select, update'))`,
    );
    expect(sequences).toEqual([]);
  });

  it("grants_signed_in_users_exactly_the_reviewed_table_privileges", async () => {
    const grants = await rows<{ grant: string }>(
      `select table_name || ' ' || privilege_type as grant
       from information_schema.role_table_grants
       where grantee = 'authenticated' and table_schema = 'public'
       union all
       select table_name || ' ' || privilege_type
         || ' (' || string_agg(column_name, ', ' order by column_name) || ')'
       from information_schema.column_privileges cp
       where grantee = 'authenticated' and table_schema = 'public'
         and not exists (
           select 1 from information_schema.role_table_grants t
           where t.grantee = cp.grantee and t.table_schema = cp.table_schema
             and t.table_name = cp.table_name and t.privilege_type = cp.privilege_type
         )
       group by table_name, privilege_type`,
    );
    // Writes are column-limited; everything else goes through audited
    // workflow functions. Change this list only after reviewing the grant.
    expect(grants.map((g) => g.grant).sort()).toEqual([
      "asset_assignments SELECT",
      "asset_documents DELETE",
      "asset_documents INSERT (asset_id, bucket_name, document_type, file_size_bytes, maintenance_request_id, mime_type, original_filename, storage_path)",
      "asset_documents SELECT",
      "assets INSERT (category, department, description, name, purchase_date, registered_building_id, registered_room_id, serial_number, warranty_until)",
      "assets SELECT",
      "assets UPDATE (category, department, description, name, purchase_date, registered_building_id, registered_room_id, serial_number, status, warranty_until)",
      "audit_logs SELECT",
      "buildings INSERT (code, description, is_active, name)",
      "buildings SELECT",
      "buildings UPDATE (code, description, is_active, name)",
      "maintenance_history INSERT (action, maintenance_request_id, notes)",
      "maintenance_history SELECT",
      "maintenance_requests SELECT",
      "notifications SELECT",
      "notifications UPDATE (is_read)",
      "profiles SELECT",
      "profiles UPDATE (department, full_name, phone)",
      "rooms INSERT (building_id, display_name, is_active, room_number)",
      "rooms SELECT",
      "rooms UPDATE (display_name, is_active, room_number)",
    ]);
  });

  it("applies_every_row_policy_to_signed_in_users_only", async () => {
    const policies = await rows<{ policy: string; roles: string[] }>(
      `select tablename || '.' || policyname as policy, roles::text[] as roles
       from pg_policies where schemaname in ('public', 'storage')`,
    );
    expect(policies.length).toBeGreaterThan(0);
    expect(policies.filter((p) => p.roles.join() !== "authenticated")).toEqual(
      [],
    );
  });

  describe("functions", () => {
    type Fn = {
      fn: string;
      config: string[] | null;
      anon: boolean;
      authenticated: boolean;
      to_public: boolean;
    };
    let functions: Fn[];

    beforeAll(async () => {
      functions = await rows<Fn>(
        `select n.nspname || '.' || p.proname as fn, p.proconfig as config,
           has_function_privilege('anon', p.oid, 'execute') as anon,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
           (p.proacl is null or exists (
             select 1 from aclexplode(p.proacl) a
             where a.grantee = 0 and a.privilege_type = 'EXECUTE'
           )) as to_public
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname in ('public', 'private')`,
      );
    });

    it("lets_anonymous_users_call_only_the_public_qr_lookup", () => {
      expect(functions.filter((f) => f.anon).map((f) => f.fn)).toEqual([
        "public.get_public_asset",
      ]);
    });

    it("grants_nothing_to_public_by_default", () => {
      expect(functions.filter((f) => f.to_public).map((f) => f.fn)).toEqual([]);
    });

    it("lets_signed_in_users_call_exactly_the_reviewed_functions", () => {
      // Each public function checks the caller itself (or is SECURITY
      // INVOKER, so RLS applies); the private ones are the helpers that
      // policies and invoker-rights triggers call.
      expect(
        functions
          .filter((f) => f.authenticated)
          .map((f) => f.fn)
          .sort(),
      ).toEqual([
        "private.asset_status_transition_allowed",
        "private.current_user_role",
        "private.current_workflow",
        "private.document_registered",
        "private.is_active_user",
        "private.is_admin",
        "private.is_technician",
        "public.admin_dashboard",
        "public.assign_asset",
        "public.assign_technician",
        "public.cancel_maintenance",
        "public.change_user_role",
        "public.get_public_asset",
        "public.list_asset_departments",
        "public.list_open_maintenance",
        "public.my_dashboard",
        "public.report_problem",
        "public.request_asset",
        "public.resolve_maintenance",
        "public.return_asset",
        "public.set_user_active",
        "public.start_maintenance",
        "public.technician_dashboard",
        "public.transfer_asset",
      ]);
    });

    it("pins_an_empty_search_path_on_every_function", () => {
      expect(
        functions
          .filter((f) => !f.config?.includes('search_path=""'))
          .map((f) => f.fn),
      ).toEqual([]);
    });
  });

  it("keeps_the_private_schema_away_from_anonymous_users", async () => {
    const [usage] = await rows<{ anon: boolean }>(
      "select has_schema_privilege('anon', 'private', 'usage') as anon",
    );
    expect(usage.anon).toBe(false);
  });

  it("keeps_every_bucket_private_with_size_and_type_limits", async () => {
    const buckets = await rows<{
      id: string;
      public: boolean;
      file_size_limit: number | null;
      allowed_mime_types: string[] | null;
    }>(
      "select id, public, file_size_limit, allowed_mime_types from storage.buckets",
    );
    expect(buckets.length).toBe(3);
    for (const bucket of buckets) {
      expect(bucket.public, bucket.id).toBe(false);
      expect(Number(bucket.file_size_limit), bucket.id).toBeGreaterThan(0);
      expect(Number(bucket.file_size_limit), bucket.id).toBeLessThanOrEqual(
        10 * 1024 * 1024,
      );
      expect(bucket.allowed_mime_types?.length, bucket.id).toBeGreaterThan(0);
      for (const type of bucket.allowed_mime_types ?? []) {
        expect(type, bucket.id).not.toMatch(/\*|html|svg|xml|javascript/);
      }
    }
  });

  it("never_lets_stored_objects_be_overwritten", async () => {
    const commands = await rows<{ cmd: string }>(
      "select distinct cmd from pg_policies where schemaname = 'storage' order by cmd",
    );
    expect(commands.map((c) => c.cmd)).toEqual(["DELETE", "INSERT", "SELECT"]);
  });

  it("makes_history_and_audit_logs_append_only_even_for_the_owner", async () => {
    // Row triggers (tgtype: 8 = DELETE, 16 = UPDATE) that reject the change,
    // so even the service role and the table owner cannot rewrite history.
    const guarded = await rows<{ table: string }>(
      `select c.relname as table
       from pg_trigger t
       join pg_class c on c.oid = t.tgrelid
       join pg_proc p on p.oid = t.tgfoid
       where p.proname = 'prevent_modification' and (t.tgtype & 24) = 24
       order by 1`,
    );
    expect(guarded.map((g) => g.table)).toEqual([
      "audit_logs",
      "maintenance_history",
    ]);

    const admin = await createUser(db, "append-only@test", "ADMIN");
    await db.query(
      "insert into public.audit_logs (actor_id, action, entity_type) values ($1, 'ASSET_CREATED', 'asset')",
      [admin],
    );
    await expectDbError(
      db.query("update public.audit_logs set action = 'FORGED'"),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    await expectDbError(
      db.query("delete from public.audit_logs"),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });
});

// ---------------------------------------------------------------------------

describe("unauthorized operations", () => {
  const users = {} as Record<
    "admin" | "technician" | "student" | "staff" | "inactiveAdmin",
    string
  >;
  let asset: string;
  let spareAsset: string;
  let assignment: string;
  let request: string;
  let room: { id: string; building_id: string };

  beforeAll(async () => {
    users.admin = await createUser(db, "sec-admin@test", "ADMIN");
    users.technician = await createUser(db, "sec-tech@test", "TECHNICIAN");
    users.student = await createUser(db, "sec-student@test", "STUDENT");
    users.staff = await createUser(db, "sec-staff@test", "STAFF");
    users.inactiveAdmin = await createUser(db, "sec-former@test", "ADMIN");
    await db.query(
      "update public.profiles set is_active = false where id = $1",
      [users.inactiveAdmin],
    );

    room = await getRoom(db, "VK404");
    asset = (await createAsset(db, "VY001")).id;
    spareAsset = (await createAsset(db, "VY101")).id;
    assignment = (
      await db.query<{ id: string }>(
        `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
         values ($1, $2, $3, $4) returning id`,
        [asset, users.student, room.building_id, room.id],
      )
    ).rows[0].id;
    request = (
      await db.query<{ id: string }>(
        `insert into public.maintenance_requests (asset_id, reported_by, description)
         values ($1, $2, 'Flickering') returning id`,
        [asset, users.student],
      )
    ).rows[0].id;
  });

  /** Admin-only workflows, called with real records as `caller`. */
  function adminCalls(caller: string): Array<[string, string, unknown[]]> {
    return [
      [
        "assign_asset",
        "select public.assign_asset($1, $2, $3, $4, null, null)",
        [spareAsset, caller, room.building_id, room.id],
      ],
      [
        "transfer_asset",
        "select public.transfer_asset($1, $2, $3, $4, null, null)",
        [assignment, caller, room.building_id, room.id],
      ],
      [
        "assign_technician",
        "select public.assign_technician($1, $2)",
        [request, users.technician],
      ],
      [
        "cancel_maintenance",
        "select public.cancel_maintenance($1, 'Not needed any more')",
        [request],
      ],
      [
        "change_user_role (promote self)",
        "select public.change_user_role($1, 'ADMIN')",
        [caller],
      ],
      [
        "set_user_active",
        "select public.set_user_active($1, true)",
        [users.inactiveAdmin],
      ],
      ["admin_dashboard", "select public.admin_dashboard(now())", []],
    ];
  }

  const nonAdmins = [
    "student",
    "staff",
    "technician",
    "inactiveAdmin",
  ] as const;

  it.each(nonAdmins)("%s: cannot_run_admin_workflows", async (role) => {
    for (const [name, sql, params] of adminCalls(users[role])) {
      await asUser(db, users[role], () =>
        expectDbError(db.query(sql, params), PG.INSUFFICIENT_PRIVILEGE),
      ).catch((error: Error) => {
        throw new Error(`${role} could run ${name}: ${error.message}`);
      });
    }
  });

  it.each(nonAdmins)(
    "%s: cannot_manage_assets_or_locations_or_read_audit_logs",
    async (role) => {
      await asUser(db, users[role], async () => {
        await expectDbError(
          db.query(
            "insert into public.buildings (name, code) values ('Rogue Hall', 'RG')",
          ),
          PG.INSUFFICIENT_PRIVILEGE,
        );
        await expectDbError(
          db.query(
            `insert into public.assets (name, category, registered_building_id, registered_room_id)
             values ('Rogue', 'Laptop', $1, $2)`,
            [room.building_id, room.id],
          ),
          PG.INSUFFICIENT_PRIVILEGE,
        );
        const retire = await db.query(
          "update public.assets set status = 'RETIRED' where id = $1",
          [spareAsset],
        );
        expect(retire.affectedRows).toBe(0);
        const audit = await db.query("select 1 from public.audit_logs");
        expect(audit.rows).toEqual([]);
      });
    },
  );

  const everyone = [...nonAdmins, "admin"] as const;

  it.each(everyone)(
    "%s: cannot_bypass_workflows_with_direct_writes",
    async (role) => {
      const self = users[role];
      // Each statement must be refused outright by grants, whatever the role:
      // roles and account status change only through the audited functions,
      // audit and notification rows are written only by the database, and
      // nothing is hard-deleted.
      const refused: Array<[string, unknown[]]> = [
        ["update public.profiles set role = 'ADMIN' where id = $1", [self]],
        ["update public.profiles set is_active = true where id = $1", [self]],
        [
          "update public.profiles set email = 'x@evil.test' where id = $1",
          [self],
        ],
        [
          "update public.assets set asset_id = 'AST-0000-00001' where id = $1",
          [asset],
        ],
        [
          "update public.maintenance_requests set status = 'RESOLVED' where id = $1",
          [request],
        ],
        [
          "update public.asset_assignments set status = 'RETURNED' where id = $1",
          [assignment],
        ],
        [
          `insert into public.asset_assignments (asset_id, user_id, usage_building_id, usage_room_id)
           values ($1, $2, $3, $4)`,
          [spareAsset, self, room.building_id, room.id],
        ],
        [
          "insert into public.maintenance_requests (asset_id, description) values ($1, 'Direct insert')",
          [asset],
        ],
        [
          "insert into public.audit_logs (action, entity_type) values ('ASSET_CREATED', 'asset')",
          [],
        ],
        ["update public.audit_logs set action = 'FORGED'", []],
        ["delete from public.audit_logs", []],
        [
          "insert into public.notifications (user_id, type, title, message, dedupe_key) values ($1, 'ASSIGNMENT_OVERDUE', 't', 'm', 'k')",
          [self],
        ],
        ["delete from public.notifications", []],
        ["delete from public.assets where id = $1", [asset]],
        ["delete from public.profiles where id = $1", [self]],
        ["delete from public.maintenance_requests where id = $1", [request]],
        ["delete from public.maintenance_history", []],
        ["delete from public.asset_assignments where id = $1", [assignment]],
        ["delete from public.buildings", []],
        ["delete from public.rooms", []],
      ];
      for (const [sql, params] of refused) {
        await asUser(db, self, () =>
          expectDbError(db.query(sql, params), PG.INSUFFICIENT_PRIVILEGE),
        ).catch((error: Error) => {
          throw new Error(`${role} was not refused: ${sql} (${error.message})`);
        });
      }
    },
  );
});
