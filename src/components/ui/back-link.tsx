import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </Link>
  );
}
