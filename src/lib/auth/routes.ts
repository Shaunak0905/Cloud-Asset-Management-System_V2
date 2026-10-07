import type { UserRole } from "./types";

// Route access rules shared by the proxy, page guards and login redirects.
// These decide navigation only; RLS remains the data-access boundary.

export const LOGIN_PATH = "/login";
export const FORBIDDEN_PATH = "/forbidden";
export const ACCOUNT_INACTIVE_PATH = "/account-inactive";

/** Paths that require a signed-in user. Anonymous requests go to /login. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/assets",
  "/maintenance",
  "/assignments",
  "/notifications",
  "/profile",
  "/admin",
  "/technician",
  ACCOUNT_INACTIVE_PATH,
] as const;

/** Paths limited to specific roles (docs/05-authentication.md §41). */
const ROLE_RESTRICTED_PREFIXES: ReadonlyArray<{
  prefix: string;
  roles: readonly UserRole[];
}> = [
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/technician", roles: ["TECHNICIAN"] },
];

const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: "/admin",
  TECHNICIAN: "/technician",
  STAFF: "/dashboard",
  STUDENT: "/dashboard",
};

/** Segment-aware prefix match: "/asset" does not match "/assets". */
export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const rule = ROLE_RESTRICTED_PREFIXES.find(({ prefix }) =>
    matchesPrefix(pathname, prefix),
  );
  return !rule || rule.roles.includes(role);
}

export function homePathForRole(role: UserRole): string {
  return ROLE_HOME[role];
}

const BASE = "http://localhost";

/**
 * Returns `value` if it is a same-origin relative path that is safe to
 * redirect to after login, otherwise null. Prevents open redirects such as
 * "//evil.example" or "/\evil.example", and loops back to /login.
 */
export function safeRedirectPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//") || /[\p{Cc}\\]/u.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE || matchesPrefix(url.pathname, LOGIN_PATH)) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Where to send a user after signing in: `next` if allowed, else their home. */
export function postLoginPath(role: UserRole, next: unknown): string {
  const path = safeRedirectPath(next);
  if (path && canAccessPath(role, new URL(path, BASE).pathname)) {
    return path;
  }
  return homePathForRole(role);
}

/** The login URL that returns the user to `pathname + search` afterwards. */
export function loginPathWithNext(pathname: string, search = ""): string {
  const next = safeRedirectPath(`${pathname}${search}`);
  return next && next !== "/"
    ? `${LOGIN_PATH}?next=${encodeURIComponent(next)}`
    : LOGIN_PATH;
}
