import Link from "next/link";

export type DistributionItem = {
  key: string;
  label: string;
  count: number;
  href?: string;
};

/**
 * Counts as labelled bars (docs/12 §5–7, §30–31). The number is always
 * written out — the bar only adds a sense of proportion — so nothing depends
 * on reading a graphic, and no chart library is needed.
 */
export function DistributionList({
  items,
  label,
  emptyText,
}: {
  items: DistributionItem[];
  label: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">{emptyText}</p>;
  }
  const max = Math.max(...items.map((item) => item.count), 1);

  return (
    <ul aria-label={label} className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            {item.href ? (
              <Link
                href={item.href}
                className="truncate text-blue-700 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span className="truncate text-slate-700">{item.label}</span>
            )}
            <span className="font-medium text-slate-900 tabular-nums">
              {item.count}
            </span>
          </div>
          <div aria-hidden className="mt-1 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
