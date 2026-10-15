import { QrCode } from "lucide-react";
import Link from "next/link";

export function Brand({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2.5 rounded-md font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-700 via-indigo-600 to-cyan-500 text-white shadow-xs transition-transform duration-200 group-hover:scale-105">
        <QrCode aria-hidden className="size-4.5" />
      </span>
      <span className="flex items-center gap-1.5">
        <span>Campus Assets</span>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-700 uppercase">
          v2
        </span>
      </span>
    </Link>
  );
}
