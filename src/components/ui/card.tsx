import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type CardProps = {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({
  title,
  description,
  actions,
  children,
  className,
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-slate-200/90 bg-white shadow-xs transition-shadow hover:shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-3.5">
          <div>
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}
