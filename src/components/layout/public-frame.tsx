import { QrCode } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Minimal mobile-first frame for public pages (no app navigation). */
export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-blue-700 text-white">
              <QrCode aria-hidden className="size-5" />
            </span>
            Campus Asset Management
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
