import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Client Components. Uses the public anon key; every
 * query is subject to RLS as the signed-in user (or anonymous).
 */
export function createClient() {
  const { url, anonKey } = requireSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
