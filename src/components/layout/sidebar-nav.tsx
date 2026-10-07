"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/lib/auth/types";
import { isNavItemActive, navigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils/cn";

type SidebarNavProps = {
  role: UserRole;
  /** Counts shown next to links, by href (e.g. unread notifications). */
  badges?: Readonly<Record<string, number>>;
  /** Called after a link is chosen (the mobile drawer closes itself). */
  onNavigate?: () => void;
};

export function SidebarNav({ role, badges, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <ul className="space-y-1">
      {navigationForRole(role).map((item) => {
        const active = isNavItemActive(item, pathname);
        const Icon = item.icon;
        const badge = badges?.[item.href] ?? 0;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              aria-label={
                badge > 0 ? `${item.label}, ${badge} unread` : undefined
              }
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-blue-700",
                active
                  ? "bg-blue-50 text-blue-800"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  "size-5",
                  active ? "text-blue-700" : "text-slate-400",
                )}
              />
              {item.label}
              {badge > 0 && (
                <span
                  aria-hidden
                  className="ml-auto rounded-full bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white tabular-nums"
                >
                  {badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
