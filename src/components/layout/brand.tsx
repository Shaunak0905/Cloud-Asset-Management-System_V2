import { QrCode } from "lucide-react";
import Link from "next/link";

export function Brand({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-blue-700 text-white">
        <QrCode aria-hidden className="size-5" />
      </span>
      Campus Assets
    </Link>
  );
}
