import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

// What anyone can do without an account (docs/14 §34–35, §43, §47–48, §60):
// scan a QR code, be sent to sign in, and nothing more. Runs on a desktop and
// a phone-sized viewport. Needs no test accounts.

/** A seeded asset; set E2E_PUBLIC_ASSET_ID if your project has others. */
const ASSET_ID = process.env.E2E_PUBLIC_ASSET_ID || "AST-2026-00001";

const AXE = readFileSync(
  path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js"),
  "utf8",
);

/** Serious or critical accessibility problems on the current page. */
async function accessibilityProblems(page: Page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
    const result = await axe.run(document, {
      resultTypes: ["violations"],
    });
    return result.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      );
  });
}

/** True when the page is wider than the screen (sideways scrolling). */
function overflowsSideways(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
}

test.describe("public QR page", () => {
  test("shows_the_asset_and_offers_sign_in_without_private_details", async ({
    page,
  }) => {
    const response = await page.goto(`/asset/${ASSET_ID}`);
    test.skip(
      response?.status() === 404,
      `No asset ${ASSET_ID} here; set E2E_PUBLIC_ASSET_ID.`,
    );

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(ASSET_ID).first()).toBeVisible();
    await expect(page.getByText("Home location")).toBeVisible();
    await expect(page.getByText(/serial/i)).toHaveCount(0);

    const signIn = page.getByRole("link", {
      name: "Sign in to request or report a problem",
    });
    await expect(signIn).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(`/asset/${ASSET_ID}`)}`,
    );

    expect(await overflowsSideways(page)).toBe(false);
    expect(await accessibilityProblems(page)).toEqual([]);
  });

  test("explains_an_unknown_code_instead_of_failing", async ({ page }) => {
    const response = await page.goto("/asset/AST-1999-99999");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await overflowsSideways(page)).toBe(false);
  });
});

test.describe("signing in", () => {
  test("shows_field_errors_for_an_empty_or_invalid_form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    // The email is kept; nothing was sent to Supabase.
    await expect(page.getByLabel("Email")).toHaveValue("not-an-email");
  });

  test("is_usable_on_every_screen_size", async ({ page }) => {
    await page.goto("/login");
    expect(await overflowsSideways(page)).toBe(false);
    expect(await accessibilityProblems(page)).toEqual([]);
  });
});

test.describe("signed-out visitors", () => {
  for (const route of [
    "/dashboard",
    "/assets?status=AVAILABLE",
    "/maintenance",
    "/notifications",
    "/admin",
    "/admin/users",
    "/admin/audit-logs",
    "/technician/maintenance",
  ]) {
    test(`are_sent_to_sign_in_from ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(`/login?next=${encodeURIComponent(route)}`);
      await expect(
        page.getByRole("heading", { name: "Sign in" }),
      ).toBeVisible();
    });
  }

  test("cannot_open_stored_files", async ({ request }) => {
    for (const id of [crypto.randomUUID(), "../../etc/passwd", "not-a-uuid"]) {
      const response = await request.get(
        `/api/files/${encodeURIComponent(id)}`,
        {
          maxRedirects: 0,
        },
      );
      expect(response.status(), id).toBe(404);
      expect(await response.text()).toBe("File unavailable.");
    }
  });
});

test.describe("responses", () => {
  test("carry_the_security_headers", async ({ request }) => {
    const response = await request.get("/login");
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("health_check_reports_the_database_and_auth", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();
    expect(body).toMatchObject({
      status: "ok",
      checks: { auth: "ok", database: "ok" },
      session: { authenticated: false },
    });
    expect(response.headers()["cache-control"]).toBe("no-store");
  });
});
