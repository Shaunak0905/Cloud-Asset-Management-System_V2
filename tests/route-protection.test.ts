import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isProtectedPath } from "@/lib/auth/routes";

// Layouts do not re-run on client-side navigation, so every page in the
// signed-in route group must run its own guard. This test fails if a page is
// added without one, or a new section is not covered by the proxy.

const APP_GROUP = path.resolve(import.meta.dirname, "../src/app/(app)");

const pages = readdirSync(APP_GROUP, { recursive: true, encoding: "utf8" })
  .filter((file) => path.basename(file) === "page.tsx")
  .map((file) => ({
    route: `/${path.dirname(file).split(path.sep).join("/")}`,
    source: readFileSync(path.join(APP_GROUP, file), "utf8"),
  }));

const REQUIRED_GUARD: Array<{ prefix: string; guard: string }> = [
  { prefix: "/admin", guard: 'requireRole(["ADMIN"])' },
  { prefix: "/technician", guard: 'requireRole(["TECHNICIAN"])' },
];

describe("route protection", () => {
  it("finds_the_signed_in_pages", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(pages)("$route: is_behind_the_proxy_login_gate", ({ route }) => {
    expect(isProtectedPath(route)).toBe(true);
  });

  it.each(pages)("$route: calls_a_page_guard", ({ route, source }) => {
    const rule = REQUIRED_GUARD.find(
      ({ prefix }) => route === prefix || route.startsWith(`${prefix}/`),
    );
    if (rule) {
      expect(source, `${route} must call ${rule.guard}`).toContain(rule.guard);
    } else {
      expect(
        /requireUser\(\)|requireRole\(/.test(source),
        `${route} must call requireUser() or requireRole()`,
      ).toBe(true);
    }
  });
});
