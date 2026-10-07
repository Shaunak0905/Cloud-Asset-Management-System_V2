import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input, Select } from "@/components/ui/input";
import { MAINTENANCE_PRIORITY, MAINTENANCE_STATUS } from "@/lib/labels";
import {
  hasMaintenanceFilters,
  MAINTENANCE_SORTS,
  type MaintenanceListParams,
  type MaintenanceStatus,
  UNASSIGNED,
} from "@/lib/maintenance/schema";
import { Constants } from "@/types/database";

/**
 * Search, filters and sort as a GET form, so the URL holds the state
 * (docs/08 §40–42, docs/10 §40). `statuses` and `allStatusesLabel` adapt the
 * status filter (e.g. a technician's queue, where "no status" means open
 * work); `technicians` adds the technician filter (admin list).
 */
export function MaintenanceFilters({
  basePath,
  params,
  statuses = Constants.public.Enums.maintenance_status,
  allStatusesLabel = "All statuses",
  defaultSortLabel = "Newest first",
  technicians,
}: {
  basePath: string;
  params: MaintenanceListParams;
  statuses?: readonly MaintenanceStatus[];
  allStatusesLabel?: string;
  /** What the list shows when no sort is chosen. */
  defaultSortLabel?: string;
  technicians?: ReadonlyArray<{ id: string; full_name: string }>;
}) {
  return (
    <Form
      action={basePath}
      role="search"
      aria-label="Filter maintenance requests"
      className="mb-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <div className="relative">
          <label htmlFor="maintenance-search" className="sr-only">
            Search maintenance requests
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            id="maintenance-search"
            name="search"
            type="search"
            placeholder="Search by request number, asset ID or asset name"
            defaultValue={params.search ?? ""}
            className="pl-9"
          />
        </div>

        <FilterSelect
          id="filter-status"
          name="status"
          label="Status"
          allLabel={allStatusesLabel}
          value={params.status}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {MAINTENANCE_STATUS[status].label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filter-priority"
          name="priority"
          label="Priority"
          allLabel="All priorities"
          value={params.priority}
        >
          {Constants.public.Enums.maintenance_priority.map((priority) => (
            <option key={priority} value={priority}>
              {MAINTENANCE_PRIORITY[priority].label}
            </option>
          ))}
        </FilterSelect>
      </div>

      <div
        className={
          technicians
            ? "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            : "mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3"
        }
      >
        {technicians && (
          <Field id="filter-technician" label="Technician">
            <Select
              id="filter-technician"
              name="technician"
              defaultValue={params.technician ?? ""}
            >
              <option value="">Any technician</option>
              <option value={UNASSIGNED}>Not assigned yet</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.full_name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field id="filter-from" label="Reported from">
          <Input
            id="filter-from"
            name="from"
            type="date"
            defaultValue={params.from ?? ""}
          />
        </Field>
        <Field id="filter-to" label="Reported to">
          <Input
            id="filter-to"
            name="to"
            type="date"
            defaultValue={params.to ?? ""}
          />
        </Field>
        <Field id="filter-sort" label="Sort by">
          <Select id="filter-sort" name="sort" defaultValue={params.sort ?? ""}>
            <option value="">{defaultSortLabel}</option>
            {Object.entries(MAINTENANCE_SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-slate-500">Dates are campus time.</p>
        {(hasMaintenanceFilters(params) || params.sort) && (
          <Link
            href={basePath}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Clear filters
          </Link>
        )}
        <Button type="submit" size="sm">
          Apply
        </Button>
      </div>
    </Form>
  );
}
