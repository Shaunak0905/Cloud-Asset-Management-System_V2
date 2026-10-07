import { Card } from "@/components/ui/card";
import { Skeleton, Spinner } from "@/components/ui/loading";
import { cn } from "@/lib/utils/cn";

/** Stand-in for a row of stat cards while the numbers load (docs/12 §33). */
export function StatGridSkeleton({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3", className)}>
      <span className="sr-only" role="status">
        Loading {label}…
      </span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Stand-in for a dashboard card while its list loads. */
export function CardSkeleton({ title }: { title: string }) {
  return (
    <Card title={title}>
      <div className="space-y-3">
        <Spinner label={`Loading ${title.toLowerCase()}…`} />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </Card>
  );
}
