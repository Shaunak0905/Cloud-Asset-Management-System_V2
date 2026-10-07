import type { ReactNode } from "react";

type MessagePageProps = {
  /** Short label above the title, e.g. an HTTP-style status. */
  eyebrow?: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

/** Centered full-page message for access, error and not-found states. */
export function MessagePage({
  eyebrow,
  title,
  children,
  actions,
}: MessagePageProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        {eyebrow && (
          <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-xl font-semibold text-slate-900">{title}</h1>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
        {actions && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </main>
  );
}
