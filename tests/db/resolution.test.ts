import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { resolutionAssetStates } from "@/lib/maintenance/resolution";
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

// Maintenance resolution and cancellation: docs/16 Phase 13, docs/08 §26–29,
// docs/04 §44, docs/13 §21–22.

let db: PGlite;
const users = {} as Record<
  "admin" | "techA" | "techB" | "student" | "other",
  string
>;

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.techA = await createUser(db, "tech-a@test", "TECHNICIAN");
  users.techB = await createUser(db, "tech-b@test", "TECHNICIAN");
  users.student = await createUser(db, "student@test", "STUDENT");
  users.other = await createUser(db, "other@test", "STUDENT");
});

type Request = { id: string; number: string; assetId: string };

async function report(assetId: string, priority = "HIGH"): Promise<Request> {
  const { rows } = await asUser(db, users.student, () =>
    db.query<{ n: string }>("select public.report_problem($1, $2, $3) as n", [
      assetId,
      "Projector shows no image.",
      priority,
    ]),
  );
  const request = await db.query<{ id: string }>(
    "select id from public.maintenance_requests where request_number = $1",
    [rows[0].n],
  );
  return { id: request.rows[0].id, number: rows[0].n, assetId };
}

/** A request on a new asset, assigned to technician A (and started). */
async function requestInProgress(priority = "HIGH", assetId?: string) {
  const asset = assetId ?? (await createAsset(db)).id;
  const request = await report(asset, priority);
  await asUser(db, users.admin, () =>
    db.query("select public.assign_technician($1, $2)", [
      request.id,
      users.techA,
    ]),
  );
  await asUser(db, users.techA, () =>
    db.query("select public.start_maintenance($1)", [request.id]),
  );
  return request;
}

function resolve(
  caller: string | null,
  requestId: string,
  assetStatus: string | null,
  notes: string | null = "Replaced the HDMI board and tested it.",
) {
  return asUser(db, caller, () =>
    db.query<{ status: string }>(
      "select public.resolve_maintenance($1, $2, $3) as status",
      [requestId, notes, assetStatus],
    ),
  );
}

function cancel(
  caller: string | null,
  requestId: string,
  reason: string | null = "Duplicate of an earlier report.",
) {
  return asUser(db, caller, () =>
    db.query<{ status: string }>(
      "select public.cancel_maintenance($1, $2) as status",
      [requestId, reason],
    ),
  );
}

async function requestRow(id: string) {
  const { rows } = await db.query<{
    status: string;
    resolution_notes: string | null;
    resolved_at: string | null;
    cancellation_reason: string | null;
    cancelled_at: string | null;
  }>(
    `select status, resolution_notes, resolved_at, cancellation_reason, cancelled_at
     from public.maintenance_requests where id = $1`,
    [id],
  );
  return rows[0];
}

async function assetStatus(id: string) {
  const { rows } = await db.query<{ status: string }>(
    "select status from public.assets where id = $1",
    [id],
  );
  return rows[0].status;
}

async function setAssetStatus(id: string, status: string) {
  await db.query("update public.assets set status = $1 where id = $2", [
    status,
    id,
  ]);
}

async function lastHistory(requestId: string) {
  const { rows } = await db.query<{
    action: string;
    performed_by: string;
    notes: string | null;
  }>(
    `select action, performed_by, notes from public.maintenance_history
     where maintenance_request_id = $1
     order by performed_at desc, created_at desc limit 1`,
    [requestId],
  );
  return rows[0];
}

async function auditActions(entityId: string) {
  const { rows } = await db.query<{ action: string }>(
    "select action from public.audit_logs where entity_id = $1 order by created_at",
    [entityId],
  );
  return rows.map((r) => r.action);
}

// ---------------------------------------------------------------------------

describe("resolve_maintenance", () => {
  it("closes_the_request_returns_the_asset_to_service_and_records_everything", async () => {
    const request = await requestInProgress("HIGH");
    expect(await assetStatus(request.assetId)).toBe("IN_MAINTENANCE");

    const { rows } = await resolve(
      users.techA,
      request.id,
      "AVAILABLE",
      "  Replaced the lamp.  ",
    );

    expect(rows[0].status).toBe("AVAILABLE");
    const row = await requestRow(request.id);
    expect(row).toMatchObject({
      status: "RESOLVED",
      resolution_notes: "Replaced the lamp.",
    });
    expect(row.resolved_at).not.toBeNull();
    expect(await assetStatus(request.assetId)).toBe("AVAILABLE");

    expect(await lastHistory(request.id)).toEqual({
      action: "RESOLVED",
      performed_by: users.techA,
      notes: "The asset is back in service.",
    });

    const { rows: audit } = await db.query<{
      actor_id: string;
      metadata: Record<string, unknown>;
    }>(
      "select actor_id, metadata from public.audit_logs where entity_id = $1 and action = 'MAINTENANCE_RESOLVED'",
      [request.id],
    );
    expect(audit).toEqual([
      {
        actor_id: users.techA,
        metadata: expect.objectContaining({
          request_number: request.number,
          final_asset_status: "AVAILABLE",
        }),
      },
    ]);
    // The notes stay on the request, not in the audit log.
    expect(JSON.stringify(audit)).not.toContain("lamp");

    const { rows: assetAudit } = await db.query<{ actor_id: string }>(
      `select actor_id from public.audit_logs
       where entity_id = $1 and action = 'ASSET_STATUS_CHANGED'
       order by created_at desc limit 1`,
      [request.assetId],
    );
    expect(assetAudit[0].actor_id).toBe(users.techA);
  });

  it("can_mark_the_asset_damaged", async () => {
    const request = await requestInProgress("HIGH");
    const { rows } = await resolve(users.techA, request.id, "DAMAGED");
    expect(rows[0].status).toBe("DAMAGED");
    expect(await assetStatus(request.assetId)).toBe("DAMAGED");
    expect((await lastHistory(request.id)).notes).toBe(
      "The asset is still damaged.",
    );
  });

  it("lets_only_admins_retire_the_asset", async () => {
    const request = await requestInProgress("CRITICAL");
    await expectDbError(
      resolve(users.techA, request.id, "RETIRED"),
      PG.INSUFFICIENT_PRIVILEGE,
    );
    expect((await requestRow(request.id)).status).toBe("IN_PROGRESS");

    await resolve(users.admin, request.id, "RETIRED");
    expect(await assetStatus(request.assetId)).toBe("RETIRED");
    expect(await auditActions(request.assetId)).toContain("ASSET_RETIRED");
  });

  it("keeps_the_asset_in_maintenance_while_another_serious_problem_is_open", async () => {
    const request = await requestInProgress("HIGH");
    await report(request.assetId, "CRITICAL");

    const { rows } = await resolve(users.techA, request.id, "AVAILABLE");
    expect(rows[0].status).toBe("IN_MAINTENANCE");
    expect(await assetStatus(request.assetId)).toBe("IN_MAINTENANCE");
    expect((await lastHistory(request.id)).notes).toContain(
      "another serious problem is still open",
    );
  });

  it("leaves_an_asset_with_a_minor_problem_in_service", async () => {
    const request = await requestInProgress("LOW");
    expect(await assetStatus(request.assetId)).toBe("AVAILABLE");
    await resolve(users.techA, request.id, "AVAILABLE");
    expect(await assetStatus(request.assetId)).toBe("AVAILABLE");
    expect(await auditActions(request.assetId)).not.toContain(
      "ASSET_STATUS_CHANGED",
    );
  });

  it("leaves_an_asset_in_use_with_its_user_until_it_is_returned", async () => {
    const asset = await createAsset(db);
    const room = await getRoom(db, "VK404");
    const { rows: taken } = await asUser(db, users.other, () =>
      db.query<{ id: string }>(
        "select public.request_asset($1, $2, $3) as id",
        [asset.id, room.building_id, room.id],
      ),
    );
    const request = await requestInProgress("HIGH", asset.id);

    // No final state can be chosen for an asset someone is using.
    await expectDbError(resolve(users.techA, request.id, "AVAILABLE"), "CA010");
    const { rows } = await resolve(users.techA, request.id, null);
    expect(rows[0].status).toBe("ASSIGNED");
    expect((await lastHistory(request.id)).notes).toBe(
      "The asset stays with the person using it.",
    );

    // The problem is resolved, so returning it puts it back into use.
    await asUser(db, users.other, () =>
      db.query("select public.return_asset($1)", [taken[0].id]),
    );
    expect(await assetStatus(asset.id)).toBe("AVAILABLE");
  });

  it("keeps_a_lost_asset_lost", async () => {
    const request = await requestInProgress("LOW");
    await setAssetStatus(request.assetId, "LOST");
    await expectDbError(resolve(users.techA, request.id, "AVAILABLE"), "CA010");
    await resolve(users.techA, request.id, null);
    expect(await assetStatus(request.assetId)).toBe("LOST");
  });

  it("requires_a_valid_final_state_for_an_asset_that_can_change", async () => {
    const request = await requestInProgress("HIGH");
    await expectDbError(resolve(users.techA, request.id, null), "CA010");
    await expectDbError(
      resolve(users.techA, request.id, "IN_MAINTENANCE"),
      "CA010",
    );
    await expectDbError(resolve(users.techA, request.id, "LOST"), "CA010");
    expect((await requestRow(request.id)).status).toBe("IN_PROGRESS");
  });

  it("requires_resolution_notes_within_the_limit", async () => {
    const request = await requestInProgress("HIGH");
    await expectDbError(
      resolve(users.techA, request.id, "AVAILABLE", "   "),
      PG.CHECK_VIOLATION,
    );
    await expectDbError(
      resolve(users.techA, request.id, "AVAILABLE", null),
      PG.CHECK_VIOLATION,
    );
    await expectDbError(
      resolve(users.techA, request.id, "AVAILABLE", "x".repeat(4001)),
      PG.CHECK_VIOLATION,
    );
  });

  it("requires_work_to_have_started", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id, "LOW");
    await expectDbError(resolve(users.admin, request.id, "AVAILABLE"), "CA009");

    await asUser(db, users.admin, () =>
      db.query("select public.assign_technician($1, $2)", [
        request.id,
        users.techA,
      ]),
    );
    await expectDbError(resolve(users.techA, request.id, "AVAILABLE"), "CA009");
  });

  it("refuses_closed_requests", async () => {
    const request = await requestInProgress("LOW");
    await resolve(users.techA, request.id, "AVAILABLE");
    await expectDbError(resolve(users.techA, request.id, "AVAILABLE"), "CA007");
  });

  it("refuses_other_technicians_the_reporter_and_anonymous_callers", async () => {
    const request = await requestInProgress("HIGH");
    for (const caller of [users.techB, users.student, null]) {
      await expectDbError(
        resolve(caller, request.id, "AVAILABLE"),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    }
    expect((await requestRow(request.id)).status).toBe("IN_PROGRESS");
  });

  it("lets_an_admin_resolve_any_request", async () => {
    const request = await requestInProgress("HIGH");
    await resolve(users.admin, request.id, "AVAILABLE");
    expect((await lastHistory(request.id)).performed_by).toBe(users.admin);
  });

  it("rejects_an_unknown_request", async () => {
    await expectDbError(
      resolve(users.admin, "00000000-0000-4000-8000-000000000000", "AVAILABLE"),
      "P0002",
    );
  });

  it("offers_the_same_final_states_as_the_resolve_form", async () => {
    for (const status of Constants.public.Enums.asset_status) {
      for (const isAdmin of [true, false]) {
        const { rows } = await db.query<{ states: string[] | null }>(
          "select private.resolution_asset_states($1, $2)::text[] as states",
          [status, isAdmin],
        );
        expect(rows[0].states, `${status} admin=${isAdmin}`).toEqual(
          resolutionAssetStates(status, isAdmin),
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe("cancel_maintenance", () => {
  it("closes_an_open_request_with_a_reason_the_reporter_can_read", async () => {
    const asset = await createAsset(db);
    const request = await report(asset.id, "LOW");

    await cancel(users.admin, request.id, "  Duplicate of MR-2026-0001.  ");

    const row = await requestRow(request.id);
    expect(row).toMatchObject({
      status: "CANCELLED",
      cancellation_reason: "Duplicate of MR-2026-0001.",
    });
    expect(row.cancelled_at).not.toBeNull();
    expect(await lastHistory(request.id)).toEqual({
      action: "CANCELLED",
      performed_by: users.admin,
      notes: "Duplicate of MR-2026-0001.",
    });
    expect(await auditActions(request.id)).toEqual([
      "MAINTENANCE_CREATED",
      "MAINTENANCE_CANCELLED",
    ]);

    const seen = await asUser(db, users.student, () =>
      db.query<{ status: string; cancellation_reason: string }>(
        "select status, cancellation_reason from public.maintenance_requests where id = $1",
        [request.id],
      ),
    );
    expect(seen.rows).toEqual([
      {
        status: "CANCELLED",
        cancellation_reason: "Duplicate of MR-2026-0001.",
      },
    ]);
  });

  it("can_cancel_an_assigned_request_but_not_one_in_progress", async () => {
    const asset = await createAsset(db);
    const assigned = await report(asset.id, "LOW");
    await asUser(db, users.admin, () =>
      db.query("select public.assign_technician($1, $2)", [
        assigned.id,
        users.techA,
      ]),
    );
    await cancel(users.admin, assigned.id);
    expect((await requestRow(assigned.id)).status).toBe("CANCELLED");

    const started = await requestInProgress("LOW");
    await expectDbError(cancel(users.admin, started.id), "CA009");
    await expectDbError(cancel(users.admin, assigned.id), "CA007");
  });

  it("is_admin_only", async () => {
    const request = await requestInProgress("LOW");
    const open = await report((await createAsset(db)).id, "LOW");
    for (const caller of [users.techA, users.student, null]) {
      await expectDbError(cancel(caller, open.id), PG.INSUFFICIENT_PRIVILEGE);
    }
    await expectDbError(
      cancel(users.techA, request.id),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });

  it("requires_a_reason_within_the_limit", async () => {
    const request = await report((await createAsset(db)).id, "LOW");
    await expectDbError(
      cancel(users.admin, request.id, "  "),
      PG.CHECK_VIOLATION,
    );
    await expectDbError(
      cancel(users.admin, request.id, null),
      PG.CHECK_VIOLATION,
    );
    await expectDbError(
      cancel(users.admin, request.id, "x".repeat(501)),
      PG.CHECK_VIOLATION,
    );
    expect((await requestRow(request.id)).status).toBe("OPEN");
  });

  it("releases_an_asset_a_serious_report_took_out_of_service", async () => {
    const request = await report((await createAsset(db)).id, "HIGH");
    expect(await assetStatus(request.assetId)).toBe("IN_MAINTENANCE");

    const { rows } = await cancel(users.admin, request.id);
    expect(rows[0].status).toBe("AVAILABLE");
    expect(await assetStatus(request.assetId)).toBe("AVAILABLE");
  });

  it("keeps_the_asset_out_of_service_while_another_serious_problem_is_open", async () => {
    const asset = await createAsset(db);
    const duplicate = await report(asset.id, "HIGH");
    await report(asset.id, "CRITICAL");

    await cancel(users.admin, duplicate.id);
    expect(await assetStatus(asset.id)).toBe("IN_MAINTENANCE");
  });

  it("does_not_release_an_asset_for_a_minor_report", async () => {
    // Out of service for another reason (set by an admin), not this report.
    const request = await report((await createAsset(db)).id, "LOW");
    await setAssetStatus(request.assetId, "IN_MAINTENANCE");
    await cancel(users.admin, request.id);
    expect(await assetStatus(request.assetId)).toBe("IN_MAINTENANCE");
  });
});

// ---------------------------------------------------------------------------

describe("maintenance lifecycle end to end", () => {
  it("runs_from_report_to_resolution_with_a_full_audit_trail", async () => {
    const request = await requestInProgress("HIGH");
    await asUser(db, users.techA, () =>
      db.query(
        `insert into public.maintenance_history (maintenance_request_id, action, notes)
         values ($1, 'REPAIR', 'Replaced the HDMI board.')`,
        [request.id],
      ),
    );
    await resolve(users.techA, request.id, "AVAILABLE");

    expect(await auditActions(request.id)).toEqual([
      "MAINTENANCE_CREATED",
      "MAINTENANCE_ASSIGNED",
      "MAINTENANCE_STARTED",
      "MAINTENANCE_HISTORY_ADDED",
      "MAINTENANCE_RESOLVED",
    ]);

    // The reporter sees the outcome; the asset can be requested again.
    const seen = await asUser(db, users.student, () =>
      db.query<{ status: string; resolution_notes: string }>(
        "select status, resolution_notes from public.maintenance_requests where id = $1",
        [request.id],
      ),
    );
    expect(seen.rows[0]).toEqual({
      status: "RESOLVED",
      resolution_notes: "Replaced the HDMI board and tested it.",
    });
    const room = await getRoom(db, "VY101");
    await asUser(db, users.other, () =>
      db.query("select public.request_asset($1, $2, $3)", [
        request.assetId,
        room.building_id,
        room.id,
      ]),
    );
    expect(await assetStatus(request.assetId)).toBe("ASSIGNED");
  });
});

describe("resolution privileges", () => {
  it.each([
    "resolve_maintenance(uuid, text, asset_status)",
    "cancel_maintenance(uuid, text)",
  ])("only_signed_in_users_can_execute_%s", async (signature) => {
    const { rows } = await db.query<{ anon: boolean; authed: boolean }>(
      `select has_function_privilege('anon', $1, 'execute') as anon,
              has_function_privilege('authenticated', $1, 'execute') as authed`,
      [`public.${signature}`],
    );
    expect(rows[0]).toEqual({ anon: false, authed: true });
  });

  it("keeps_the_final_state_rule_private", async () => {
    const { rows } = await db.query<{ authed: boolean }>(
      "select has_function_privilege('authenticated', 'private.resolution_asset_states(asset_status, boolean)', 'execute') as authed",
    );
    expect(rows[0].authed).toBe(false);
  });
});
