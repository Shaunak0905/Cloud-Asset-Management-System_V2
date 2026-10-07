import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { WORK_NOTE_ACTIONS } from "@/lib/maintenance/schema";
import { Constants } from "@/types/database";

import {
  asUser,
  createAsset,
  createTestDatabase,
  createUser,
  expectDbError,
  PG,
} from "./helpers";

// Technician workflow: docs/16 Phase 12, docs/08 §14–20, §34–35, §48–50.

let db: PGlite;
const users = {} as Record<
  "admin" | "techA" | "techB" | "student" | "staff" | "inactiveTech",
  string
>;

beforeAll(async () => {
  db = await createTestDatabase();
  users.admin = await createUser(db, "admin@test", "ADMIN");
  users.techA = await createUser(db, "tech-a@test", "TECHNICIAN");
  users.techB = await createUser(db, "tech-b@test", "TECHNICIAN");
  users.student = await createUser(db, "student@test", "STUDENT");
  users.staff = await createUser(db, "staff@test", "STAFF");
  users.inactiveTech = await createUser(db, "gone@test", "TECHNICIAN");
  await db.query(
    "update public.profiles set full_name = 'Ravi Kumar' where id = $1",
    [users.techA],
  );
  await db.query(
    "update public.profiles set full_name = 'Priya Shah' where id = $1",
    [users.techB],
  );
  await db.query("update public.profiles set is_active = false where id = $1", [
    users.inactiveTech,
  ]);
});

/** A new OPEN request reported by the student; returns its id. */
async function openRequest(priority = "MEDIUM") {
  const asset = await createAsset(db);
  const { rows } = await asUser(db, users.student, () =>
    db.query<{ n: string }>("select public.report_problem($1, $2, $3) as n", [
      asset.id,
      "Projector shows no image.",
      priority,
    ]),
  );
  const request = await db.query<{ id: string }>(
    "select id from public.maintenance_requests where request_number = $1",
    [rows[0].n],
  );
  return { id: request.rows[0].id, assetId: asset.id, number: rows[0].n };
}

function assign(caller: string | null, requestId: string, technician: string) {
  return asUser(db, caller, () =>
    db.query("select public.assign_technician($1, $2)", [
      requestId,
      technician,
    ]),
  );
}

function start(caller: string | null, requestId: string) {
  return asUser(db, caller, () =>
    db.query("select public.start_maintenance($1)", [requestId]),
  );
}

function addNote(
  caller: string,
  requestId: string,
  action = "DIAGNOSIS",
  notes: string | null = "HDMI board is faulty.",
) {
  return asUser(db, caller, () =>
    db.query<{ id: string }>(
      `insert into public.maintenance_history (maintenance_request_id, action, notes)
       values ($1, $2, $3) returning id`,
      [requestId, action, notes],
    ),
  );
}

async function requestState(id: string) {
  const { rows } = await db.query<{
    status: string;
    assigned_to: string | null;
    assigned_at: string | null;
  }>(
    "select status, assigned_to, assigned_at from public.maintenance_requests where id = $1",
    [id],
  );
  return rows[0];
}

async function history(requestId: string) {
  const { rows } = await db.query<{
    action: string;
    performed_by: string;
    notes: string | null;
  }>(
    `select action, performed_by, notes from public.maintenance_history
     where maintenance_request_id = $1 order by performed_at, created_at`,
    [requestId],
  );
  return rows;
}

async function audit(requestId: string, action: string) {
  const { rows } = await db.query<{
    actor_id: string | null;
    old_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }>(
    `select actor_id, old_values, new_values, metadata from public.audit_logs
     where entity_id = $1 and action = $2 order by created_at`,
    [requestId, action],
  );
  return rows;
}

async function close(requestId: string, status: "RESOLVED" | "CANCELLED") {
  // Superuser shortcut until the resolution workflow exists (next phase).
  if (status === "RESOLVED") {
    const { status: current } = await requestState(requestId);
    if (current === "ASSIGNED") {
      await db.query(
        "update public.maintenance_requests set status = 'IN_PROGRESS' where id = $1",
        [requestId],
      );
    }
    await db.query(
      "update public.maintenance_requests set status = 'RESOLVED', resolution_notes = 'Fixed' where id = $1",
      [requestId],
    );
  } else {
    await db.query(
      "update public.maintenance_requests set status = 'CANCELLED' where id = $1",
      [requestId],
    );
  }
}

// ---------------------------------------------------------------------------

describe("assign_technician", () => {
  it("assigns_an_open_request_and_records_history_and_audit", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);

    const state = await requestState(request.id);
    expect(state).toMatchObject({
      status: "ASSIGNED",
      assigned_to: users.techA,
    });
    expect(state.assigned_at).not.toBeNull();

    expect((await history(request.id)).at(-1)).toEqual({
      action: "ASSIGNED",
      performed_by: users.admin,
      notes: "Assigned to Ravi Kumar",
    });
    expect(await audit(request.id, "MAINTENANCE_ASSIGNED")).toEqual([
      {
        actor_id: users.admin,
        old_values: { status: "OPEN", assigned_to: null },
        new_values: { status: "ASSIGNED", assigned_to: users.techA },
        metadata: expect.objectContaining({
          request_number: request.number,
          technician_id: users.techA,
        }),
      },
    ]);
  });

  it.each(["student", "staff", "techA"] as const)(
    "is_refused_to_%s",
    async (who) => {
      const request = await openRequest();
      await expectDbError(
        assign(users[who], request.id, users.techA),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      expect((await requestState(request.id)).status).toBe("OPEN");
    },
  );

  it("is_refused_to_anonymous_callers", async () => {
    const request = await openRequest();
    await expectDbError(
      assign(null, request.id, users.techA),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });

  it.each(["student", "admin", "inactiveTech"] as const)(
    "only_accepts_active_technicians_not_%s",
    async (who) => {
      const request = await openRequest();
      await expectDbError(assign(users.admin, request.id, users[who]), "CA008");
      expect((await requestState(request.id)).status).toBe("OPEN");
    },
  );

  it("rejects_an_unknown_user_and_an_unknown_request", async () => {
    const request = await openRequest();
    const nobody = "00000000-0000-4000-8000-000000000000";
    await expectDbError(assign(users.admin, request.id, nobody), "CA008");
    await expectDbError(assign(users.admin, nobody, users.techA), "P0002");
  });

  it("hands_the_request_to_another_technician_and_keeps_its_status", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await start(users.techA, request.id);

    await assign(users.admin, request.id, users.techB);

    expect(await requestState(request.id)).toMatchObject({
      status: "IN_PROGRESS",
      assigned_to: users.techB,
    });
    expect((await history(request.id)).at(-1)?.notes).toBe(
      "Reassigned to Priya Shah (previously Ravi Kumar)",
    );
    expect(
      (await audit(request.id, "MAINTENANCE_ASSIGNED")).at(-1),
    ).toMatchObject({
      old_values: { status: "IN_PROGRESS", assigned_to: users.techA },
      new_values: { status: "IN_PROGRESS", assigned_to: users.techB },
    });

    // Visibility follows the assignment.
    const seenBy = async (tech: string) =>
      (
        await asUser(db, tech, () =>
          db.query("select 1 from public.maintenance_requests where id = $1", [
            request.id,
          ]),
        )
      ).rows.length;
    expect(await seenBy(users.techA)).toBe(0);
    expect(await seenBy(users.techB)).toBe(1);
  });

  it("does_nothing_when_the_same_technician_is_assigned_again", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await assign(users.admin, request.id, users.techA);

    expect(
      (await history(request.id)).filter((h) => h.action === "ASSIGNED"),
    ).toHaveLength(1);
    expect(await audit(request.id, "MAINTENANCE_ASSIGNED")).toHaveLength(1);
  });

  it.each(["RESOLVED", "CANCELLED"] as const)(
    "refuses_%s_requests",
    async (status) => {
      const request = await openRequest();
      await assign(users.admin, request.id, users.techA);
      await close(request.id, status);
      await expectDbError(
        assign(users.admin, request.id, users.techB),
        "CA007",
      );
    },
  );
});

// ---------------------------------------------------------------------------

describe("start_maintenance", () => {
  it("lets_the_assigned_technician_start_work", async () => {
    const request = await openRequest("HIGH");
    await assign(users.admin, request.id, users.techA);
    const { rows: before } = await db.query<{ status: string }>(
      "select status from public.assets where id = $1",
      [request.assetId],
    );

    await start(users.techA, request.id);

    expect((await requestState(request.id)).status).toBe("IN_PROGRESS");
    expect((await history(request.id)).at(-1)).toEqual({
      action: "STARTED",
      performed_by: users.techA,
      notes: null,
    });
    expect(await audit(request.id, "MAINTENANCE_STARTED")).toEqual([
      {
        actor_id: users.techA,
        old_values: { status: "ASSIGNED" },
        new_values: { status: "IN_PROGRESS" },
        metadata: expect.objectContaining({ request_number: request.number }),
      },
    ]);

    // The asset's status is decided at report and resolution, not here.
    const { rows: after } = await db.query<{ status: string }>(
      "select status from public.assets where id = $1",
      [request.assetId],
    );
    expect(after[0].status).toBe(before[0].status);
  });

  it("lets_an_admin_start_work_too", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await start(users.admin, request.id);
    expect((await requestState(request.id)).status).toBe("IN_PROGRESS");
  });

  it("refuses_other_technicians_the_reporter_and_anonymous_callers", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    for (const caller of [users.techB, users.student, null]) {
      await expectDbError(start(caller, request.id), PG.INSUFFICIENT_PRIVILEGE);
    }
    expect((await requestState(request.id)).status).toBe("ASSIGNED");
  });

  it("refuses_a_technician_whose_account_was_deactivated", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await db.query(
      "update public.profiles set is_active = false where id = $1",
      [users.techA],
    );
    try {
      await expectDbError(
        start(users.techA, request.id),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    } finally {
      await db.query(
        "update public.profiles set is_active = true where id = $1",
        [users.techA],
      );
    }
  });

  it("needs_a_technician_first", async () => {
    const request = await openRequest();
    await expectDbError(start(users.admin, request.id), "CA009");
  });

  it("does_nothing_when_work_has_already_started", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await start(users.techA, request.id);
    await start(users.techA, request.id);
    expect(
      (await history(request.id)).filter((h) => h.action === "STARTED"),
    ).toHaveLength(1);
  });

  it("refuses_closed_requests", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await close(request.id, "CANCELLED");
    await expectDbError(start(users.techA, request.id), "CA007");
  });
});

// ---------------------------------------------------------------------------

describe("work notes", () => {
  it("accept_exactly_the_entry_types_the_note_form_offers", async () => {
    // The form lists WORK_NOTE_ACTIONS; workflow steps are not offered.
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    const accepted = [];
    for (const action of Constants.public.Enums.maintenance_action) {
      try {
        await addNote(users.techA, request.id, action, "Entry");
        accepted.push(action);
      } catch (error) {
        expect(error).toMatchObject({ code: PG.INSUFFICIENT_PRIVILEGE });
      }
    }
    expect(accepted).toEqual([...WORK_NOTE_ACTIONS]);
  });

  it("are_audited_without_copying_the_note_text", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await start(users.techA, request.id);

    const { rows } = await addNote(users.techA, request.id, "PART_REPLACEMENT");

    expect(await audit(request.id, "MAINTENANCE_HISTORY_ADDED")).toEqual([
      {
        actor_id: users.techA,
        old_values: null,
        new_values: null,
        metadata: {
          request_number: request.number,
          history_entry_id: rows[0].id,
          history_type: "PART_REPLACEMENT",
        },
      },
    ]);
  });

  it("can_be_added_before_work_starts_and_by_admins", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await addNote(users.techA, request.id, "INSPECTION", "Checked the cable.");
    await addNote(users.admin, request.id, "NOTE", "Spare part ordered.");
    expect((await history(request.id)).map((h) => h.action)).toEqual([
      "REPORTED",
      "ASSIGNED",
      "INSPECTION",
      "NOTE",
    ]);
  });

  it("must_say_something", async () => {
    const request = await openRequest();
    await assign(users.admin, request.id, users.techA);
    await expectDbError(
      addNote(users.techA, request.id, "NOTE", "   "),
      PG.CHECK_VIOLATION,
    );
    await expectDbError(
      addNote(users.techA, request.id, "REPAIR", null),
      PG.CHECK_VIOLATION,
    );
  });

  it("are_refused_to_the_reporter_and_on_open_or_closed_requests", async () => {
    const request = await openRequest();
    await expectDbError(
      addNote(users.admin, request.id),
      PG.INSUFFICIENT_PRIVILEGE,
    );

    await assign(users.admin, request.id, users.techA);
    await expectDbError(
      addNote(users.student, request.id),
      PG.INSUFFICIENT_PRIVILEGE,
    );

    await close(request.id, "RESOLVED");
    await expectDbError(
      addNote(users.techA, request.id),
      PG.INSUFFICIENT_PRIVILEGE,
    );
  });
});

// ---------------------------------------------------------------------------

describe("technician workflow end to end", () => {
  it("gives_the_technician_the_full_log_and_the_reporter_only_the_status", async () => {
    const request = await openRequest("HIGH");
    await assign(users.admin, request.id, users.techA);
    await start(users.techA, request.id);
    await addNote(users.techA, request.id, "DIAGNOSIS", "Lamp is dead.");

    const techView = await asUser(db, users.techA, () =>
      db.query<{ action: string }>(
        `select action from public.maintenance_history
         where maintenance_request_id = $1 order by performed_at, created_at`,
        [request.id],
      ),
    );
    expect(techView.rows.map((r) => r.action)).toEqual([
      "REPORTED",
      "ASSIGNED",
      "STARTED",
      "DIAGNOSIS",
    ]);

    const reporterView = await asUser(db, users.student, () =>
      db.query<{ status: string }>(
        "select status from public.maintenance_requests where id = $1",
        [request.id],
      ),
    );
    expect(reporterView.rows).toEqual([{ status: "IN_PROGRESS" }]);
    const reporterHistory = await asUser(db, users.student, () =>
      db.query(
        "select 1 from public.maintenance_history where maintenance_request_id = $1",
        [request.id],
      ),
    );
    expect(reporterHistory.rows).toHaveLength(0);
  });
});

describe("technician workflow privileges", () => {
  it.each(["assign_technician(uuid, uuid)", "start_maintenance(uuid)"])(
    "only_signed_in_users_can_execute_%s",
    async (signature) => {
      const { rows } = await db.query<{ anon: boolean; authed: boolean }>(
        `select has_function_privilege('anon', $1, 'execute') as anon,
                has_function_privilege('authenticated', $1, 'execute') as authed`,
        [`public.${signature}`],
      );
      expect(rows[0]).toEqual({ anon: false, authed: true });
    },
  );

  it("keeps_the_helpers_private", async () => {
    const { rows } = await db.query<{ name: boolean; audit: boolean }>(
      `select has_function_privilege('authenticated', 'private.profile_display_name(uuid)', 'execute') as name,
              has_function_privilege('authenticated', 'private.audit_work_note()', 'execute') as audit`,
    );
    expect(rows[0]).toEqual({ name: false, audit: false });
  });
});
