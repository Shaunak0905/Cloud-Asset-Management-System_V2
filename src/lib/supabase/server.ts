import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requireSupabaseConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads the user's session from cookies, so queries run under RLS as that
 * user. Create a new client per request — never share one across requests.
 */
export async function createClient() {
  // Cookies first: it marks the page as rendered per request, so a build
  // without Supabase settings (CI, a fresh clone) does not try to prerender
  // signed-in pages and fail on the missing configuration.
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. This is safe to ignore
          // because src/proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
