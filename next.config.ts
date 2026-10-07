import type { NextConfig } from "next";

/**
 * The Supabase origin the browser talks to: image signed URLs (img-src) and
 * direct uploads to Storage (connect-src). Null when unset or invalid.
 */
function supabaseOrigin(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
}

/**
 * Content Security Policy without nonces (pages keep their normal
 * rendering). Its job here is to stop framing (clickjacking), plugins,
 * <base> and form hijacking, and to limit where the page can load images
 * from and send data to: this app and its Supabase project only. React
 * needs 'unsafe-eval' in development only.
 */
export function contentSecurityPolicy({
  supabase = supabaseOrigin(),
  dev = process.env.NODE_ENV === "development",
}: { supabase?: string | null; dev?: boolean } = {}): string {
  const remote = supabase ? ` ${supabase}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${remote}`,
    "font-src 'self' data:",
    `connect-src 'self'${remote}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Browsers ignore this over plain http, so local development is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
