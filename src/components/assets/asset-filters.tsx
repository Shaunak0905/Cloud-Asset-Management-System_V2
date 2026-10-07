import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input, Select } from "@/components/ui/input";
import { ASSET_CATEGORIES } from "@/lib/assets/constants";
import {
  ASSET_SORTS,
  type AssetListParams,
  hasActiveFilters,
} from "@/lib/assets/schema";
import { ASSET_STATUS } from "@/lib/labels";
import type { BuildingOption } from "@/lib/locations/types";
import { Constants } from "@/types/database";

type AssetFiltersProps = {
  basePath: string;
  params: AssetListParams;
  buildings: BuildingOption[];
  departments: string[];
};

/**
 * Search + filters as a GET form: the URL holds the state, so filtered views
 * can be bookmarked and shared, and it works without JavaScript.
 */
export function AssetFilters({
  basePath,
  params,
  buildings,
  departments,
}: AssetFiltersProps) {
  return (
    <Form
      action={basePath}
      role="search"
      aria-label="Filter assets"
      className="mb-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[2fr_repeat(4,1fr)]">
        <div className="relative md:col-span-2 lg:col-span-1">
          <label htmlFor="asset-search" className="sr-only">
            Search assets
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            id="asset-search"
            name="search"
            type="search"
            placeholder="Search by asset ID, name, serial or category"
            defaultValue={params.search ?? ""}
            className="pl-9"
          />
        </div>

        <FilterSelect
          id="filter-status"
          name="status"
          label="Status"
          allLabel="All statuses"
          value={params.status}
        >
          {Constants.public.Enums.asset_status.map((status) => (
            <option key={status} value={status}>
              {ASSET_STATUS[status].label}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filter-category"
          name="category"
          label="Category"
          allLabel="All categories"
          value={params.category}
        >
          {ASSET_CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filter-building"
          name="building"
          label="Building"
          allLabel="All buildings"
          value={params.buildingId}
        >
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id="filter-department"
          name="department"
          label="Department"
          allLabel="All departments"
          value={params.department}
        >
          {departments.map((department) => (
            <option key={department}>{department}</option>
          ))}
        </FilterSelect>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <div className="mr-auto flex items-center gap-2">
          <label
            htmlFor="asset-sort"
            className="text-sm whitespace-nowrap text-slate-600"
          >
            Sort by
          </label>
          <div className="w-52">
            <Select
              id="asset-sort"
              name="sort"
              defaultValue={params.sort ?? ""}
            >
              <option value="">Newest first</option>
              {Object.entries(ASSET_SORTS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {(hasActiveFilters(params) || params.sort) && (
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
