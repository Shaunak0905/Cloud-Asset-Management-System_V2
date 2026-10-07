import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isProtectedPath, loginPathWithNext } from "@/lib/auth/routes";
import { getSupabaseConfig } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Runs on every request:
 * 1. Refreshes the Supabase auth session and writes updated auth cookies to
 *    both the request (for Server Components) and the response (browser).
 * 2. Optimistic gate: anonymous requests to protected paths are redirected to
 *    /login?next=<path>. This only checks for a valid session. Roles are
 *    checked by page guards, and data access by RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const result = getSupabaseConfig();
  if (!result.ok) {
    // Not configured yet: let the page render its setup message.
    return response;
  }

  const { url, anonKey } = result.config;
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Prevents CDNs from caching responses that carry auth cookies.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between creating the client and this call: it validates
  // the JWT and triggers a token refresh when needed.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  if (!isAuthenticated && isProtectedPath(pathname)) {
    const redirect = NextResponse.redirect(
      new URL(loginPathWithNext(pathname, search), request.url),
    );
    // Keep any cookie changes (e.g. a cleared expired session).
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  return response;
}
