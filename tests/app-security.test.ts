import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig, { contentSecurityPolicy } from "../next.config";

// Security review checks for the application code (docs/04 §32–41, docs/16
// Phase 21). RLS is the data boundary; these keep the layers in front of it
// honest and fail when a change slips past them.

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const sourceFiles = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.(ts|tsx)$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => ({
    file: `src/${file.split(path.sep).join("/")}`,
    source: readFileSync(path.join(SRC, file), "utf8"),
  }));

/** Every exported function of every "use server" module, with its body. */
const serverActions = sourceFiles
  .filter(({ source }) => /^["']use server["'];/m.test(source))
  .flatMap(({ file, source }) => {
    const parts = source.split(/^export async function (\w+)/m);
    const actions: Array<{ name: string; body: string }> = [];
    for (let i = 1; i < parts.length; i += 2) {
      actions.push({ name: `${file}#${parts[i]}`, body: parts[i + 1] });
    }
    return actions;
  });

// Signing in and out is how a session starts and ends, so they cannot
// require one.
const SESSION_ACTIONS = [
  "src/lib/auth/actions.ts#signIn",
  "src/lib/auth/actions.ts#signOut",
];

describe("server actions", () => {
  it("finds_the_server_actions", () => {
    expect(serverActions.length).toBeGreaterThan(20);
  });

  it("export_only_async_functions", () => {
    // Anything exported from a "use server" module is callable from the
    // browser; a stray export would be an unreviewed endpoint.
    for (const { file, source } of sourceFiles) {
      if (!/^["']use server["'];/m.test(source)) continue;
      const exports = source.match(/^export .*/gm) ?? [];
      for (const line of exports) {
        expect(line, file).toMatch(/^export async function \w+\(/);
      }
    }
  });

  it.each(
    serverActions
      .filter(({ name }) => !SESSION_ACTIONS.includes(name))
      .map((action) => [action.name, action.body]),
  )("%s: checks_the_user_before_touching_the_database", (name, body) => {
    const guard = body.search(/await requireUser\(\)|await requireRole\(/);
    expect(guard, `${name} must call requireUser() or requireRole()`).not.toBe(
      -1,
    );
    const database = body.indexOf("createClient(");
    if (database !== -1) {
      expect(guard, `${name} must check the user first`).toBeLessThan(database);
    }
  });
});

describe("secrets", () => {
  it("never_reference_the_service_role_key_in_app_code", () => {
    const leaks = sourceFiles.filter(({ source }) =>
      /SERVICE_ROLE|service_role|sb_secret_/.test(source),
    );
    expect(leaks.map((l) => l.file)).toEqual([]);
  });

  it("expose_only_the_reviewed_public_variables_to_the_browser", () => {
    const names = new Set(
      sourceFiles.flatMap(({ source }) =>
        [...source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map((m) => m[0]),
      ),
    );
    expect([...names].sort()).toEqual([
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });

  it("keep_env_files_out_of_git_and_the_template_empty", () => {
    const gitignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.env\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);

    const template = readFileSync(path.join(ROOT, ".env.example"), "utf8");
    // The service key is documented only as a commented-out, empty line.
    expect(template).not.toMatch(/^SUPABASE_SERVICE_ROLE_KEY=/m);
    expect(template).toMatch(/^# SUPABASE_SERVICE_ROLE_KEY=$/m);
    expect(template).toMatch(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=$/m);
  });
});

describe("rendering", () => {
  it("never_renders_raw_html", () => {
    const raw = sourceFiles.filter(({ source }) =>
      /dangerouslySetInnerHTML|\.innerHTML\s*=/.test(source),
    );
    expect(raw.map((r) => r.file)).toEqual([]);
  });

  it("keeps_the_ui_gallery_out_of_production", () => {
    const gallery = sourceFiles.find(
      (f) => f.file === "src/app/dev/ui/page.tsx",
    );
    expect(gallery?.source).toContain(
      'if (process.env.NODE_ENV !== "development") {\n    notFound();',
    );
  });
});

describe("security headers", () => {
  it("are_sent_on_every_route", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/(.*)");
    const headers = Object.fromEntries(
      rules[0].headers.map((h) => [h.key, h.value]),
    );
    expect(headers).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    expect(headers["Content-Security-Policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("allow_only_this_app_and_its_supabase_project", () => {
    const policy = contentSecurityPolicy({
      supabase: "https://abc.supabase.co",
      dev: false,
    });
    const directives = Object.fromEntries(
      policy.split("; ").map((d) => {
        const [name, ...values] = d.split(" ");
        return [name, values.join(" ")];
      }),
    );
    expect(directives).toEqual({
      "default-src": "'self'",
      "script-src": "'self' 'unsafe-inline'",
      "style-src": "'self' 'unsafe-inline'",
      "img-src": "'self' blob: data: https://abc.supabase.co",
      "font-src": "'self' data:",
      "connect-src": "'self' https://abc.supabase.co",
      "object-src": "'none'",
      "base-uri": "'self'",
      "form-action": "'self'",
      "frame-ancestors": "'none'",
    });
    expect(contentSecurityPolicy({ supabase: null, dev: true })).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });
});
