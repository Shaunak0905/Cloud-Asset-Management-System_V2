import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import {
  asUser,
  createTestDatabase,
  createUser,
  expectDbError,
  PG,
} from "./helpers";

// In-app notifications: written only by the reminders job (service role);
// users read their own and mark them read (docs/03 §23, docs/11 §24).

let db: PGlite;
const users = {} as Record<"student" | "other" | "inactive", string>;

beforeAll(async () => {
  db = await createTestDatabase();
  users.student = await createUser(db, "student@test", "STUDENT");
  users.other = await createUser(db, "other@test", "STUDENT");
  users.inactive = await createUser(db, "gone@test", "STUDENT");
  await db.query("update public.profiles set is_active = false where id = $1", [
    users.inactive,
  ]);
});

/** Inserts as the reminders job does: as service_role (RLS bypassed). */
async function asJob<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

let keyCounter = 0;

async function notify(
  userId: string,
  overrides: Partial<
    Record<"type" | "title" | "link" | "dedupe_key", string>
  > = {},
) {
  keyCounter += 1;
  const { rows } = await asJob(() =>
    db.query<{ id: string }>(
      `insert into public.notifications (user_id, type, title, message, link, dedupe_key)
       values ($1, $2, $3, 'Please return it.', $4, $5)
       on conflict (user_id, dedupe_key) do nothing
       returning id`,
      [
        userId,
        overrides.type ?? "ASSIGNMENT_OVERDUE",
        overrides.title ?? "Overdue: Projector",
        overrides.link ?? "/assets/AST-2026-00001",
        overrides.dedupe_key ?? `overdue:a-${keyCounter}:2026-10-05`,
      ],
    ),
  );
  return rows[0]?.id;
}

describe("notifications", () => {
  it("are_visible_only_to_their_active_owner", async () => {
    const mine = await notify(users.student);
    await notify(users.other);
    await notify(users.inactive);

    const seen = async (userId: string | null) =>
      (
        await asUser(db, userId, () =>
          db.query<{ id: string }>("select id from public.notifications"),
        ).catch(() => ({ rows: [] as { id: string }[] }))
      ).rows.map((r) => r.id);

    expect(await seen(users.student)).toEqual([mine]);
    expect(await seen(users.inactive)).toEqual([]);
    await asUser(db, null, () =>
      expectDbError(
        db.query("select * from public.notifications"),
        PG.INSUFFICIENT_PRIVILEGE,
      ),
    );
  });

  it("can_be_marked_read_by_their_owner_only", async () => {
    const id = await notify(users.student);

    const byOther = await asUser(db, users.other, () =>
      db.query("update public.notifications set is_read = true where id = $1", [
        id,
      ]),
    );
    expect(byOther.affectedRows).toBe(0);

    const { rows } = await asUser(db, users.student, () =>
      db.query<{ is_read: boolean; read_at: string | null }>(
        "update public.notifications set is_read = true where id = $1 returning is_read, read_at",
        [id],
      ),
    );
    expect(rows[0].is_read).toBe(true);
    expect(rows[0].read_at).not.toBeNull();
  });

  it("cannot_be_written_or_edited_by_users", async () => {
    const id = await notify(users.student);
    await asUser(db, users.student, async () => {
      await expectDbError(
        db.query(
          `insert into public.notifications (user_id, type, title, message, dedupe_key)
           values ($1, 'ASSIGNMENT_OVERDUE', 'Fake', 'Fake', 'fake')`,
          [users.student],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query(
          "update public.notifications set title = 'Edited' where id = $1",
          [id],
        ),
        PG.INSUFFICIENT_PRIVILEGE,
      );
      await expectDbError(
        db.query("delete from public.notifications where id = $1", [id]),
        PG.INSUFFICIENT_PRIVILEGE,
      );
    });
  });

  it("are_never_sent_twice_for_the_same_reminder", async () => {
    const first = await notify(users.student, {
      dedupe_key: "warranty:x:2026-11-01",
    });
    const again = await notify(users.student, {
      dedupe_key: "warranty:x:2026-11-01",
    });
    expect(first).toBeDefined();
    expect(again).toBeUndefined();
    // The same reminder may go to someone else.
    expect(
      await notify(users.other, { dedupe_key: "warranty:x:2026-11-01" }),
    ).toBeDefined();
  });

  it.each([
    ["an external link", { link: "https://evil.example/phish" }],
    ["a protocol-relative link", { link: "//evil.example" }],
    ["a script link", { link: "javascript:alert(1)" }],
    ["an unknown type", { type: "MARKETING" }],
    ["an empty title", { title: "  " }],
  ])("reject_%s", async (_label, overrides) => {
    await expectDbError(notify(users.student, overrides), PG.CHECK_VIOLATION);
  });

  it("keep_their_content_fixed_even_for_the_job", async () => {
    const id = await notify(users.student);
    await expectDbError(
      asJob(() =>
        db.query(
          "update public.notifications set message = 'changed' where id = $1",
          [id],
        ),
      ),
      PG.CHECK_VIOLATION,
    );
  });
});

describe("the reminders job's access", () => {
  it.each([
    ["asset_assignments", "select"],
    ["assets", "select"],
    ["profiles", "select"],
    ["notifications", "select"],
    ["notifications", "insert"],
    ["notifications", "delete"],
  ])("can_%2$s_%1$s", async (table, privilege) => {
    const { rows } = await db.query<{ allowed: boolean }>(
      "select has_table_privilege('service_role', $1, $2) as allowed",
      [`public.${table}`, privilege],
    );
    expect(rows[0].allowed).toBe(true);
  });
});
