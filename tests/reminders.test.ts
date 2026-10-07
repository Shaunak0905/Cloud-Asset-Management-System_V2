import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAMPUS_TIME_ZONE as APP_TIME_ZONE } from "@/lib/format";

import {
  addDays,
  assignmentsWithUnreadReminders,
  CAMPUS_TIME_ZONE,
  campusDate,
  type Env,
  type ExpiringAsset,
  handleReminders,
  type OverdueAssignment,
  overdueReminders,
  readableDate,
  sameSecret,
  warrantyReminders,
} from "../supabase/functions/send-reminders/reminders";
import {
  buildDashboardFunction,
  OUTPUT,
} from "../scripts/build-dashboard-function.mjs";

// The send-reminders Edge Function (supabase/functions/send-reminders):
// docs/11 §24, §40, §42. Its REST calls go to a fake Supabase API here.

const ENV: Env = {
  supabaseUrl: "https://project.supabase.test",
  serviceRoleKey: "header.payload.signature",
  secret: "s3cret-value",
};
// 5 Oct 2026, 07:00 in campus time.
const NOW = new Date("2026-10-05T01:30:00Z");
const TODAY = "2026-10-05";

const projector = { asset_id: "AST-2026-00001", name: "Epson Projector P-104" };

const overdueAssignment: OverdueAssignment = {
  id: "assign-1",
  user_id: "student-1",
  expected_return_at: "2026-10-03T12:30:00Z",
  assets: projector,
};

const expiringAsset: ExpiringAsset = {
  id: "asset-2",
  asset_id: "AST-2026-00002",
  name: "Dell Latitude L-201",
  warranty_until: "2026-10-20",
};

/** Fake REST API: answers by table, records every call. */
function fakeSupabase(data: {
  overdue?: OverdueAssignment[];
  unread?: string[];
  expiring?: ExpiringAsset[];
  admins?: string[];
  failOn?: string;
}) {
  const calls: Array<{
    method: string;
    url: URL;
    body: unknown;
    headers: Record<string, string>;
  }> = [];
  const fetchFn = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({
        method,
        url,
        body,
        headers: init?.headers as Record<string, string>,
      });
      const table = url.pathname.replace("/rest/v1/", "");
      if (data.failOn === table) {
        return new Response("permission denied for table", { status: 403 });
      }
      const reply = (rows: unknown) =>
        new Response(JSON.stringify(rows), { status: 200 });
      if (table === "asset_assignments") return reply(data.overdue ?? []);
      if (table === "assets") return reply(data.expiring ?? []);
      if (table === "profiles")
        return reply((data.admins ?? []).map((id) => ({ id })));
      if (table === "notifications" && method === "GET") {
        return reply((data.unread ?? []).map((dedupe_key) => ({ dedupe_key })));
      }
      if (table === "notifications" && method === "POST") {
        return reply((body as unknown[]).map((_, i) => ({ id: `n${i}` })));
      }
      if (table === "notifications" && method === "DELETE") {
        return reply([{ id: "old-1" }, { id: "old-2" }]);
      }
      return new Response("not found", { status: 404 });
    },
  );
  return { fetchFn, calls };
}

function post(secret: string | null = ENV.secret) {
  return new Request(
    "https://project.supabase.test/functions/v1/send-reminders",
    {
      method: "POST",
      headers: secret === null ? {} : { "x-reminders-secret": secret },
    },
  );
}

describe("who may run the reminders", () => {
  it("accepts_only_posts_with_the_shared_secret", async () => {
    const { fetchFn } = fakeSupabase({});
    const get = new Request("https://x.test", { method: "GET" });
    expect((await handleReminders(get, ENV, fetchFn, NOW)).status).toBe(405);
    expect((await handleReminders(post(null), ENV, fetchFn, NOW)).status).toBe(
      401,
    );
    expect(
      (await handleReminders(post("s3cret-valuX"), ENV, fetchFn, NOW)).status,
    ).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
    expect((await handleReminders(post(), ENV, fetchFn, NOW)).status).toBe(200);
  });

  it("refuses_to_run_without_its_configuration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchFn } = fakeSupabase({});
    const response = await handleReminders(
      post(""),
      { ...ENV, secret: "" },
      fetchFn,
      NOW,
    );
    expect(response.status).toBe(500);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("compares_secrets_exactly", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abd", "abc")).toBe(false);
    expect(sameSecret("ab", "abc")).toBe(false);
  });
});

describe("a nightly run", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("reminds_holders_and_admins_and_reports_what_it_did", async () => {
    const { fetchFn, calls } = fakeSupabase({
      overdue: [overdueAssignment],
      expiring: [expiringAsset],
      admins: ["admin-1", "admin-2"],
    });

    const response = await handleReminders(post(), ENV, fetchFn, NOW);

    expect(await response.json()).toEqual({
      overdue: 1,
      warranty: 1,
      created: 3,
      removed: 2,
    });
    const insert = calls.find((c) => c.method === "POST");
    expect(insert?.url.searchParams.get("on_conflict")).toBe(
      "user_id,dedupe_key",
    );
    expect(insert?.headers.Prefer).toBe(
      "resolution=ignore-duplicates,return=representation",
    );
    expect(insert?.body).toEqual([
      expect.objectContaining({
        user_id: "student-1",
        type: "ASSIGNMENT_OVERDUE",
        dedupe_key: `overdue:assign-1:${TODAY}`,
      }),
      expect.objectContaining({
        user_id: "admin-1",
        type: "WARRANTY_EXPIRING",
      }),
      expect.objectContaining({
        user_id: "admin-2",
        type: "WARRANTY_EXPIRING",
      }),
    ]);
  });

  it("asks_the_database_only_for_what_is_due", async () => {
    const { fetchFn, calls } = fakeSupabase({});
    await handleReminders(post(), ENV, fetchFn, NOW);

    const byTable = (table: string) =>
      calls.find((c) => c.url.pathname.endsWith(`/${table}`))!.url.searchParams;
    const assignments = byTable("asset_assignments");
    expect(assignments.get("status")).toBe("eq.ACTIVE");
    expect(assignments.get("expected_return_at")).toBe(
      `lt.${NOW.toISOString()}`,
    );
    const assets = byTable("assets");
    expect(assets.get("status")).toBe("neq.RETIRED");
    expect(assets.getAll("warranty_until")).toEqual([
      `gte.${TODAY}`,
      `lte.${addDays(TODAY, 30)}`,
    ]);
  });

  it("writes_nothing_and_skips_the_admin_lookup_when_nothing_is_due", async () => {
    const { fetchFn, calls } = fakeSupabase({});
    const response = await handleReminders(post(), ENV, fetchFn, NOW);
    expect(await response.json()).toMatchObject({ created: 0 });
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect(calls.some((c) => c.url.pathname.endsWith("/profiles"))).toBe(false);
  });

  it("removes_notifications_read_more_than_90_days_ago", async () => {
    const { fetchFn, calls } = fakeSupabase({});
    await handleReminders(post(), ENV, fetchFn, NOW);
    const removal = calls.find((c) => c.method === "DELETE")!;
    expect(removal.url.searchParams.get("is_read")).toBe("eq.true");
    expect(removal.url.searchParams.get("read_at")).toBe(
      "lt.2026-07-07T01:30:00.000Z",
    );
  });

  it("uses_the_service_key_from_its_own_environment", async () => {
    const { fetchFn, calls } = fakeSupabase({});
    await handleReminders(post(), ENV, fetchFn, NOW);
    expect(calls[0].headers).toMatchObject({
      apikey: ENV.serviceRoleKey,
      Authorization: `Bearer ${ENV.serviceRoleKey}`,
    });
    // A new-style secret key is not a JWT: apikey only.
    const { fetchFn: second, calls: secondCalls } = fakeSupabase({});
    await handleReminders(
      post(),
      { ...ENV, serviceRoleKey: "sb_secret_abc" },
      second,
      NOW,
    );
    expect(secondCalls[0].headers.Authorization).toBeUndefined();
  });

  it("explains_how_to_fix_a_refused_service_key", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchFn = vi.fn(
      async () =>
        new Response('{"code":"PGRST303","message":"JWT issued at future"}', {
          status: 401,
        }),
    );
    const response = await handleReminders(post(), ENV, fetchFn, NOW);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Reminders failed" });
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining("REMINDERS_SERVICE_KEY"),
    );
  });

  it("fails_without_revealing_database_errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { fetchFn } = fakeSupabase({ failOn: "assets" });
    const response = await handleReminders(post(), ENV, fetchFn, NOW);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Reminders failed" });
  });
});

describe("reminder contents", () => {
  it("tells_the_holder_what_is_overdue_since_when_and_where_to_look", () => {
    expect(overdueReminders([overdueAssignment], new Set(), TODAY)).toEqual([
      {
        user_id: "student-1",
        type: "ASSIGNMENT_OVERDUE",
        title: "Overdue: Epson Projector P-104",
        message:
          "Epson Projector P-104 (AST-2026-00001) was due back on 3 Oct 2026. Please return it, or ask an admin for more time.",
        link: "/assets/AST-2026-00001",
        dedupe_key: "overdue:assign-1:2026-10-05",
      },
    ]);
  });

  it("does_not_add_a_reminder_while_the_last_one_is_unread", () => {
    const unread = assignmentsWithUnreadReminders([
      "overdue:assign-1:2026-10-04",
      "warranty:asset-9:2026-11-01",
    ]);
    expect([...unread]).toEqual(["assign-1"]);
    expect(overdueReminders([overdueAssignment], unread, TODAY)).toEqual([]);
  });

  it("says_when_a_warranty_ends", () => {
    const [later] = warrantyReminders([expiringAsset], ["admin-1"], TODAY);
    expect(later.message).toBe(
      "The warranty for Dell Latitude L-201 (AST-2026-00002) ends on 20 Oct 2026.",
    );
    expect(later.dedupe_key).toBe("warranty:asset-2:2026-10-20");
    const [now] = warrantyReminders(
      [{ ...expiringAsset, warranty_until: TODAY }],
      ["admin-1"],
      TODAY,
    );
    expect(now.message).toMatch(/ends today\.$/);
  });

  it("stays_within_what_the_notifications_table_accepts", () => {
    const longName = "X".repeat(300);
    const [row] = warrantyReminders(
      [{ ...expiringAsset, name: longName }],
      ["admin-1"],
      TODAY,
    );
    expect(row.title.length).toBeLessThanOrEqual(200);
    expect(row.message.length).toBeLessThanOrEqual(1000);
    // notifications_link_safe: same-site paths only.
    expect(row.link).toMatch(/^\/[A-Za-z0-9/_.?=&%-]*$/);
  });
});

describe("campus dates", () => {
  it("use_the_same_time_zone_as_the_app", () => {
    expect(CAMPUS_TIME_ZONE).toBe(APP_TIME_ZONE);
  });

  it("roll_over_at_campus_midnight", () => {
    expect(campusDate(new Date("2026-10-04T18:29:00Z"))).toBe("2026-10-04");
    expect(campusDate(new Date("2026-10-04T18:30:00Z"))).toBe("2026-10-05");
    expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
    expect(readableDate("2026-10-20")).toBe("20 Oct 2026");
  });
});

describe("dashboard copy of the function", () => {
  it("matches_the_function_source", () => {
    // If this fails: npm run reminders:dashboard, then paste the new file.
    expect(readFileSync(OUTPUT, "utf8")).toBe(buildDashboardFunction());
  });
});
