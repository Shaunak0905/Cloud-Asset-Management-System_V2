import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

import { buttonClasses } from "./button";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** URL for a page number, preserving the current filters. */
  hrefFor: (page: number) => string;
  label?: string;
};

/** "Showing 21–40 of 142" with Previous/Next links (docs/06 §26). */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  label = "results",
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-col items-center justify-between gap-3 text-sm text-slate-600 sm:flex-row"
    >
      <p>
        Showing <span className="font-medium text-slate-900">{first}</span>–
        <span className="font-medium text-slate-900">{last}</span> of{" "}
        <span className="font-medium text-slate-900">{total}</span> {label}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <PageLink href={page > 1 ? hrefFor(page - 1) : null} rel="prev">
            <ChevronLeft aria-hidden className="size-4" />
            Previous
          </PageLink>
          <span className="px-2">
            Page {page} of {pageCount}
          </span>
          <PageLink
            href={page < pageCount ? hrefFor(page + 1) : null}
            rel="next"
          >
            Next
            <ChevronRight aria-hidden className="size-4" />
          </PageLink>
        </div>
      )}
    </nav>
  );
}

function PageLink({
  href,
  rel,
  children,
}: {
  href: string | null;
  rel: "prev" | "next";
  children: ReactNode;
}) {
  const className = buttonClasses({ variant: "secondary", size: "sm" });
  if (!href) {
    return (
      <span
        aria-disabled
        className={cn(className, "pointer-events-none opacity-50")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={className}>
      {children}
    </Link>
  );
}
