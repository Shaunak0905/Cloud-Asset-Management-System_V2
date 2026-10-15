import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button";

/**
 * The welcome banner at the top of every role's dashboard: which workspace
 * this is, a greeting (the page's h1) and its main actions.
 */
export function DashboardHero({
  workspace,
  title,
  description,
  actions,
}: {
  workspace: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-6 text-white shadow-sm sm:p-8">
      <div
        aria-hidden="true"
        className="pattern-dots pointer-events-none absolute inset-0 opacity-15"
      />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-blue-100 backdrop-blur-xs">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-emerald-400"
            />
            <span>{workspace}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-blue-100/90 sm:text-base">
            {description}
          </p>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/** A white action button for the dashboard banner. */
export function HeroLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={buttonClasses({
        variant: "secondary",
        className: "border-0 bg-white text-blue-900 shadow-sm hover:bg-blue-50",
      })}
    >
      <Icon aria-hidden className="size-4 text-blue-700" />
      <span>{children}</span>
    </Link>
  );
}
