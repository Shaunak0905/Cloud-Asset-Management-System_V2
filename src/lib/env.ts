// NEXT_PUBLIC_* values are inlined at build time, so each one must be read
// with a literal `process.env.NAME` expression (no dynamic lookups).
//
// No zod here: the browser Supabase client imports this module, and these
// two checks do not justify shipping a validation library to every page.

export type SupabaseConfig = { url: string; anonKey: string };

const ENV_NAMES: Record<keyof SupabaseConfig, string> = {
  url: "NEXT_PUBLIC_SUPABASE_URL",
  anonKey: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
};

export type SupabaseConfigResult =
  { ok: true; config: SupabaseConfig } | { ok: false; problems: string[] };

/** True for an absolute http(s) URL with a host. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== ""
    );
  } catch {
    return false;
  }
}

export function getSupabaseConfig(): SupabaseConfigResult {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  const problems: string[] = [];
  if (!isHttpUrl(url)) {
    problems.push(
      url.trim()
        ? `${ENV_NAMES.url} is invalid`
        : `${ENV_NAMES.url} is not set`,
    );
  }
  if (!anonKey) problems.push(`${ENV_NAMES.anonKey} is not set`);

  return problems.length === 0
    ? { ok: true, config: { url, anonKey } }
    : { ok: false, problems };
}

export class SupabaseNotConfiguredError extends Error {
  constructor(problems: string[]) {
    super(`Supabase is not configured: ${problems.join("; ")}`);
    this.name = "SupabaseNotConfiguredError";
  }
}

export function requireSupabaseConfig(): SupabaseConfig {
  const result = getSupabaseConfig();
  if (!result.ok) {
    throw new SupabaseNotConfiguredError(result.problems);
  }
  return result.config;
}

/**
 * The public origin of the app (NEXT_PUBLIC_APP_URL), used to build QR and
 * share URLs, without a trailing slash. On Vercel it defaults to the
 * project's production domain (VERCEL_PROJECT_PRODUCTION_URL, set by Vercel
 * on every deployment), so preview deployments also print QR codes that
 * point at production. Null when unset or invalid; callers must not fall
 * back to a hard-coded domain. Server-side only.
 */
export function getAppUrl(): string | null {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (production ? `https://${production}` : "");
  if (!raw || !isHttpUrl(raw)) return null;
  const url = new URL(raw);
  if (url.search || url.hash) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
