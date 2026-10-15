export type WorkloadRow = {
  id: string;
  name: string;
  assigned: number;
  in_progress: number;
  resolved_this_month: number;
};

function Count({ value, label }: { value: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-slate-900 tabular-nums">{value}</span>{" "}
      {label}
    </span>
  );
}

/**
 * Each active technician's current work (docs/12 §11), to help decide who to
 * assign next. Deliberately not a ranking or productivity score. A list
 * rather than a table, so it fits a half-width card on any screen.
 */
export function TechnicianWorkload({ rows }: { rows: WorkloadRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        There are no active technicians. Give a user the Technician role to
        assign maintenance to them.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100" aria-label="Technician workload">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-slate-50/70 sm:py-2.5"
        >
          <span className="font-semibold text-slate-900">{row.name}</span>
          <span className="flex flex-wrap gap-x-3 text-xs text-slate-500 sm:text-sm">
            <Count value={row.assigned} label="assigned" />
            <Count value={row.in_progress} label="in progress" />
            <Count
              value={row.resolved_this_month}
              label="resolved this month"
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
