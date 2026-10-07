import { NextResponse } from "next/server";

import { getSupabaseConfig, type SupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

type AuthCheck = "ok" | "unreachable";
type DatabaseCheck = "ok" | "schema_missing" | "unreachable";

const TIMEOUT_MS = 5000;
const NO_STORE = { "Cache-Control": "no-store" };

// PostgREST error code for "table not found in the schema cache".
const TABLE_NOT_FOUND = "PGRST205";
// Postgres "permission denied": the database answered, access is restricted.
const PERMISSION_DENIED = "42501";

async function checkAuth({ url, anonKey }: SupabaseConfig): Promise<AuthCheck> {
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? "ok" : "unreachable";
  } catch (error) {
    console.error("[health] auth check failed:", (error as Error).message);
    return "unreachable";
  }
}

async function checkDatabase({
  url,
  anonKey,
}: SupabaseConfig): Promise<DatabaseCheck> {
  try {
    // `buildings` is the first table created by the schema migrations.
    // Anonymous access is limited by grants/RLS, so an empty result or a
    // permission error still proves the database is up and migrated.
    const res = await fetch(`${url}/rest/v1/buildings?select=id&limit=1`, {
      headers: { apikey: anonKey },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return "ok";

    const body = (await res.json().catch(() => null)) as {
      code?: string;
    } | null;
    if (body?.code === TABLE_NOT_FOUND) return "schema_missing";
    if (body?.code === PERMISSION_DENIED) return "ok";

    console.error("[health] database check failed with status", res.status);
    return "unreachable";
  } catch (error) {
    console.error("[health] database check failed:", (error as Error).message);
    return "unreachable";
  }
}

async function hasSession(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  return !error && Boolean(data?.claims);
}

export async function GET() {
  const result = getSupabaseConfig();
  if (!result.ok) {
    return NextResponse.json(
      { status: "not_configured", problems: result.problems },
      { status: 503, headers: NO_STORE },
    );
  }

  const [auth, database, authenticated] = await Promise.all([
    checkAuth(result.config),
    checkDatabase(result.config),
    hasSession().catch((error: Error) => {
      console.error("[health] session check failed:", error.message);
      return false;
    }),
  ]);

  const healthy = auth === "ok" && database !== "unreachable";

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: { auth, database },
      session: { authenticated },
    },
    { status: healthy ? 200 : 503, headers: NO_STORE },
  );
}
