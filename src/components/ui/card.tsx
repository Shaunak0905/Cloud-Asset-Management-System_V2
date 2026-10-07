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
        "rounded-lg border border-slate-200 bg-white shadow-xs",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-slate-600">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
