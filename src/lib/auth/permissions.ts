import type { CurrentUser, UserRole } from "./types";

// UI-level permission helpers: they decide what to show, never what is
// allowed. The database (RLS + workflow functions) enforces the same rules.

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  TECHNICIAN: "Technician",
  STAFF: "Staff",
  STUDENT: "Student",
};

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "ADMIN";
}

export function isTechnician(user: CurrentUser): boolean {
  return user.role === "TECHNICIAN";
}

export function canManageAssets(user: CurrentUser): boolean {
  return isAdmin(user);
}

export function canManageMaintenance(user: CurrentUser): boolean {
  return isAdmin(user);
}

/** The assigned technician and admins see the work log and add notes. */
export function canWorkOnMaintenance(
  user: CurrentUser,
  request: { assigned_to: string | null },
): boolean {
  return (
    isAdmin(user) || (isTechnician(user) && request.assigned_to === user.id)
  );
}

export function canViewAuditLogs(user: CurrentUser): boolean {
  return isAdmin(user);
}
