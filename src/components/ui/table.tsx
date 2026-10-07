import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Data table. Scrolls horizontally inside its own box on narrow screens, so
 * the page itself never scrolls sideways. The box is `relative` so that
 * absolutely positioned content (e.g. `sr-only` header labels) is clipped
 * by it too; otherwise such a label far to the right widens the whole page
 * on a phone.
 */
export function Table({
  className,
  caption,
  children,
  ...props
}: HTMLAttributes<HTMLTableElement> & { caption?: string }) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table
        className={cn(
          "min-w-full divide-y divide-slate-200 text-sm",
          className,
        )}
        {...props}
      >
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-slate-50" {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-slate-100" {...props} />;
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-slate-50", className)} {...props} />;
}

export function TableHeaderCell({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-slate-600 uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 text-slate-700", className)} {...props} />
  );
}
