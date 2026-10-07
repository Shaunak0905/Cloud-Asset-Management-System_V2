import {
  Bell,
  Building2,
  CircleUser,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Package,
  ScrollText,
  Users,
  Wrench,
} from "lucide-react";

import type { UserRole } from "@/lib/auth/types";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Dashboard links match exactly so they are not active on every sub-page. */
  exact?: boolean;
  /** Other sections that also highlight this link (e.g. shared detail pages). */
  alsoActiveOn?: string[];
};

const NOTIFICATIONS: NavItem = {
  label: "Notifications",
  href: "/notifications",
  icon: Bell,
};

const PROFILE: NavItem = {
  label: "Profile",
  href: "/profile",
  icon: CircleUser,
};

const MEMBER_NAVIGATION: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  { label: "Assets", href: "/assets", icon: Package },
  { label: "My Assignments", href: "/assignments", icon: ClipboardList },
  { label: "My Requests", href: "/maintenance", icon: Wrench },
  NOTIFICATIONS,
  PROFILE,
];

// Role navigation (docs/10-frontend-architecture.md §13). Hiding a link is UX
// only: every page still checks the role, and RLS protects the data.
const NAVIGATION: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    {
      label: "Assets",
      href: "/admin/assets",
      icon: Package,
      alsoActiveOn: ["/assets"],
    },
    {
      label: "Maintenance",
      href: "/admin/maintenance",
      icon: Wrench,
      alsoActiveOn: ["/maintenance"],
    },
    { label: "Buildings & Rooms", href: "/admin/buildings", icon: Building2 },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    NOTIFICATIONS,
    PROFILE,
  ],
  TECHNICIAN: [
    {
      label: "Dashboard",
      href: "/technician",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      label: "My Maintenance",
      href: "/technician/maintenance",
      icon: Wrench,
      alsoActiveOn: ["/maintenance"],
    },
    { label: "Assets", href: "/assets", icon: Package },
    NOTIFICATIONS,
    PROFILE,
  ],
  STAFF: MEMBER_NAVIGATION,
  STUDENT: MEMBER_NAVIGATION,
};

export function navigationForRole(role: UserRole): NavItem[] {
  return NAVIGATION[role];
}

function withinSection(pathname: string, section: string): boolean {
  return pathname === section || pathname.startsWith(`${section}/`);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.alsoActiveOn ?? [])].some((section) =>
    withinSection(pathname, section),
  );
}
