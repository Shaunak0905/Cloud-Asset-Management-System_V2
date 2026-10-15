import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const ICON_TONES = {
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  green: "bg-emerald-50 text-emerald-600",
} as const;

/**
 * What a dashboard section shows when it has nothing to list: why it is
 * empty and, where useful, where to go next.
 */
export function EmptyPanel({
  icon: Icon,
  tone = "blue",
  title,
  description,
  link,
}: {
  icon: LucideIcon;
  tone?: keyof typeof ICON_TONES;
  title: string;
  description: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      <span
        className={`flex size-10 items-center justify-center rounded-xl ${ICON_TONES[tone]}`}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      {link && (
        <Link
          href={link.href}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800"
        >
          <span>{link.label}</span>
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
