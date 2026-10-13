import type { PGlite } from "@electric-sql/pglite";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, expectTypeOf, it } from "vitest";

import { Constants, type Database, type Tables } from "@/types/database";

import { createTestDatabase } from "./helpers";

// src/types/database.ts is maintained by hand. These tests fail if it drifts
// from the migrations: the `satisfies` clauses force each list to contain
// exactly the keys of the TypeScript Row type, and the tests compare those
// lists with the real columns.

type ColumnSet<T extends keyof Database["public"]["Tables"]> = Record<
  keyof Tables<T>,
  true
>;

const TYPED_COLUMNS = {
  notifications: {
    id: true,
    user_id: true,
    type: true,
    title: true,
    message: true,
    link: true,
    dedupe_key: true,
    is_read: true,
    read_at: true,
    created_at: true,
  } satisfies ColumnSet<"notifications">,
  profiles: {
    id: true,
    full_name: true,
    email: true,
    role: true,
    department: true,
    phone: true,
    is_active: true,
    created_at: true,
    updated_at: true,
  } satisfies ColumnSet<"profiles">,
  buildings: {
    id: true,
    name: true,
    code: true,
    description: true,
    is_active: true,
    created_at: true,
    updated_at: true,
  } satisfies ColumnSet<"buildings">,
  rooms: {
    id: true,
    building_id: true,
    room_number: true,
    display_name: true,
    is_active: true,
    created_at: true,
    updated_at: true,
  } satisfies ColumnSet<"rooms">,
  assets: {
    id: true,
    asset_id: true,
    public_id: true,
    name: true,
    category: true,
    serial_number: true,
    department: true,
    registered_building_id: true,
    registered_room_id: true,
    status: true,
    purchase_date: true,
    warranty_until: true,
    description: true,
    created_by: true,
    created_at: true,
    updated_at: true,
    archived_at: true,
  } satisfies ColumnSet<"assets">,
  asset_assignments: {
    id: true,
    asset_id: true,
    user_id: true,
    usage_building_id: true,
    usage_room_id: true,
    status: true,
    assigned_at: true,
    expected_return_at: true,
    returned_at: true,
    notes: true,
    created_by: true,
    created_at: true,
    updated_at: true,
  } satisfies ColumnSet<"asset_assignments">,
  maintenance_requests: {
    id: true,
    request_number: true,
    asset_id: true,
    reported_by: true,
    assigned_to: true,
    description: true,
    priority: true,
    status: true,
    resolution_notes: true,
    cancellation_reason: true,
    created_at: true,
    assigned_at: true,
    resolved_at: true,
    cancelled_at: true,
    updated_at: true,
  } satisfies ColumnSet<"maintenance_requests">,
  maintenance_history: {
    id: true,
    maintenance_request_id: true,
    asset_id: true,
    performed_by: true,
    action: true,
    notes: true,
    performed_at: true,
    created_at: true,
  } satisfies ColumnSet<"maintenance_history">,
  asset_documents: {
    id: true,
    asset_id: true,
    maintenance_request_id: true,
    uploaded_by: true,
    bucket_name: true,
    storage_path: true,
    original_filename: true,
    mime_type: true,
    file_size_bytes: true,
    document_type: true,
    created_at: true,
  } satisfies ColumnSet<"asset_documents">,
  audit_logs: {
    id: true,
    actor_id: true,
    action: true,
    entity_type: true,
    entity_id: true,
    old_values: true,
    new_values: true,
    metadata: true,
    created_at: true,
  } satisfies ColumnSet<"audit_logs">,
};

type FunctionName = keyof Database["public"]["Functions"];
type ArgSet<F extends FunctionName> = Record<
  keyof Database["public"]["Functions"][F]["Args"],
  true
>;

const TYPED_FUNCTIONS = {
  admin_dashboard: {
    p_month_start: true,
  } satisfies ArgSet<"admin_dashboard">,
  assign_asset: {
    p_asset_id: true,
    p_user_id: true,
    p_usage_building_id: true,
    p_usage_room_id: true,
    p_expected_return_at: true,
    p_notes: true,
  } satisfies ArgSet<"assign_asset">,
  assign_technician: {
    p_request_id: true,
    p_technician_id: true,
  } satisfies ArgSet<"assign_technician">,
  cancel_maintenance: {
    p_request_id: true,
    p_reason: true,
  } satisfies ArgSet<"cancel_maintenance">,
  change_user_role: {
    target_user_id: true,
    new_role: true,
  } satisfies ArgSet<"change_user_role">,
  get_public_asset: { p_public_id: true } satisfies ArgSet<"get_public_asset">,
  list_asset_departments: {} satisfies ArgSet<"list_asset_departments">,
  my_dashboard: {} satisfies ArgSet<"my_dashboard">,
  list_open_maintenance: {
    p_asset_id: true,
  } satisfies ArgSet<"list_open_maintenance">,
  report_problem: {
    p_asset_id: true,
    p_description: true,
    p_priority: true,
  } satisfies ArgSet<"report_problem">,
  request_asset: {
    p_asset_id: true,
    p_usage_building_id: true,
    p_usage_room_id: true,
    p_expected_return_at: true,
    p_notes: true,
  } satisfies ArgSet<"request_asset">,
  resolve_maintenance: {
    p_request_id: true,
    p_resolution_notes: true,
    p_asset_status: true,
  } satisfies ArgSet<"resolve_maintenance">,
  return_asset: { p_assignment_id: true } satisfies ArgSet<"return_asset">,
  set_user_active: {
    target_user_id: true,
    active: true,
  } satisfies ArgSet<"set_user_active">,
  start_maintenance: {
    p_request_id: true,
  } satisfies ArgSet<"start_maintenance">,
  sustainability_dashboard: {
    p_time_zone: true,
  } satisfies ArgSet<"sustainability_dashboard">,
  technician_dashboard: {
    p_month_start: true,
  } satisfies ArgSet<"technician_dashboard">,
  transfer_asset: {
    p_assignment_id: true,
    p_to_user_id: true,
    p_usage_building_id: true,
    p_usage_room_id: true,
    p_expected_return_at: true,
    p_notes: true,
  } satisfies ArgSet<"transfer_asset">,
} satisfies Record<FunctionName, Record<string, true>>;

let db: PGlite;

beforeAll(async () => {
  db = await createTestDatabase({ seed: false });
});

describe("hand-written database types", () => {
  it("cover_every_public_table", async () => {
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
    );
    expect(rows.map((r) => r.table_name)).toEqual(
      Object.keys(TYPED_COLUMNS).sort(),
    );
  });

  it.each(Object.entries(TYPED_COLUMNS))(
    "match_the_columns_of_%s",
    async (table, columns) => {
      const { rows } = await db.query<{ column_name: string }>(
        `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = $1 order by 1`,
        [table],
      );
      expect(rows.map((r) => r.column_name)).toEqual(
        Object.keys(columns).sort(),
      );
    },
  );

  it("match_the_public_functions_and_their_arguments", async () => {
    const { rows } = await db.query<{ name: string; args: string }>(
      `select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' order by 1`,
    );
    const actual = Object.fromEntries(
      rows.map((row) => [
        row.name,
        row.args
          .split(", ")
          .filter(Boolean)
          .map((arg) => arg.split(" ")[0])
          .sort(),
      ]),
    );
    const typed = Object.fromEntries(
      Object.entries(TYPED_FUNCTIONS).map(([name, args]) => [
        name,
        Object.keys(args).sort(),
      ]),
    );
    expect(actual).toEqual(typed);
  });

  it.each(Object.entries(Constants.public.Enums))(
    "match_enum_%s",
    async (name, values) => {
      const { rows } = await db.query<{ label: string }>(
        `select e.enumlabel as label
       from pg_enum e join pg_type t on t.oid = e.enumtypid
       join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public' and t.typname = $1
       order by e.enumsortorder`,
        [name],
      );
      expect(rows.map((r) => r.label)).toEqual([...values]);
    },
  );

  it("resolve_embedded_relations_in_the_typed_client", () => {
    // Compile-time check (verified by `npm run typecheck`); the query is
    // built but never sent.
    const query = (client: SupabaseClient<Database>) =>
      client
        .from("assets")
        .select(
          "asset_id, status, buildings(name), rooms!assets_registered_room_fkey(room_number)",
        )
        .single();
    type Row = NonNullable<Awaited<ReturnType<typeof query>>["data"]>;

    expectTypeOf(query).toBeFunction();
    expectTypeOf<Row["asset_id"]>().toEqualTypeOf<string>();
    expectTypeOf<Row["status"]>().toEqualTypeOf<
      Database["public"]["Enums"]["asset_status"]
    >();
    expectTypeOf<Row["buildings"]>().toEqualTypeOf<{ name: string }>();
    expectTypeOf<Row["rooms"]>().toEqualTypeOf<{ room_number: string }>();
  });
});
