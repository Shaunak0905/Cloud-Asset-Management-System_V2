import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Keeps heavy server-side libraries out of the browser (docs/16 Phase 23,
// "Client bundle"). Follows every value import from each "use client" module
// (a "use server" module is only a reference in the client, so the walk stops
// there) and fails if it reaches zod, which once added ~90 KB gzip to every
// form page and the login page. The login page must not need supabase-js
// either: signing in happens on the server.

const SRC = path.resolve(import.meta.dirname, "../src");
const IMPORT = /^import\s+(type\s+)?([^;]*?)\s+from\s+"([^"]+)";/gm;

function resolve(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join(SRC, spec.slice(2))
    : spec.startsWith(".")
      ? path.resolve(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const file of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(file)) return file;
  }
  return null;
}

/** Packages reachable from `file` through value imports, with the path. */
function reachablePackages(file: string): Map<string, string> {
  const found = new Map<string, string>();
  const seen = new Set([file]);
  const walk = (current: string, trail: string[]) => {
    const source = readFileSync(current, "utf8");
    for (const [, typeOnly, names, spec] of source.matchAll(IMPORT)) {
      if (typeOnly) continue;
      const inner = names.trim().startsWith("{")
        ? names
            .replace(/[{}]/g, "")
            .split(",")
            .map((name) => name.trim())
            .filter(Boolean)
        : [names];
      if (inner.every((name) => name.startsWith("type "))) continue;

      const target = resolve(spec, current);
      if (!target) {
        if (!spec.startsWith("@/") && !spec.startsWith(".")) {
          found.set(spec, [...trail, spec].join(" -> "));
        }
        continue;
      }
      if (seen.has(target)) continue;
      seen.add(target);
      if (/^\s*["']use server["']/.test(readFileSync(target, "utf8"))) continue;
      walk(target, [...trail, path.relative(SRC, target)]);
    }
  };
  walk(file, [path.relative(SRC, file)]);
  return found;
}

const clientModules = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .map((f) => path.join(SRC, f))
  .filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));

describe("client bundle", () => {
  it("finds_the_client_components", () => {
    expect(clientModules.length).toBeGreaterThan(30);
  });

  it("never_ships_zod_to_the_browser", () => {
    const leaks = clientModules
      .map((file) => reachablePackages(file).get("zod"))
      .filter(Boolean);
    expect(leaks).toEqual([]);
  });

  it("keeps_the_login_page_free_of_supabase_js", () => {
    const login = path.join(SRC, "components/auth/login-form.tsx");
    const packages = [...reachablePackages(login).keys()];
    expect(packages.filter((p) => p.startsWith("@supabase/"))).toEqual([]);
  });
});
