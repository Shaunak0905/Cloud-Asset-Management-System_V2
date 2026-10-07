import { Package } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ASSETS_PAGE_SIZE } from "@/lib/assets/constants";
import {
  listAssets,
  listBuildingFilterOptions,
  listDepartments,
} from "@/lib/assets/queries";
import {
  assetListQuery,
  type AssetListParams,
  hasActiveFilters,
} from "@/lib/assets/schema";

import { AssetFilters } from "./asset-filters";
import { AssetTable } from "./asset-table";

/** Searchable, filterable, paginated asset list (shared by /assets and /admin/assets). */
export async function AssetListView({
  basePath,
  params,
  isAdmin = false,
}: {
  basePath: string;
  params: AssetListParams;
  isAdmin?: boolean;
}) {
  const [{ rows, total }, buildings, departments] = await Promise.all([
    listAssets(params),
    listBuildingFilterOptions(),
    listDepartments(),
  ]);

  const hrefFor = (page: number) =>
    `${basePath}${assetListQuery({ ...params, page })}`;

  return (
    <>
      <AssetFilters
        basePath={basePath}
        params={params}
        buildings={buildings}
        departments={departments}
      />

      {total === null ? (
        <EmptyState
          title="This page is empty"
          description="The list is shorter than the page you asked for."
          action={
            <Link
              href={hrefFor(1)}
              className={buttonClasses({ variant: "secondary" })}
            >
              Go to the first page
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            hasActiveFilters(params)
              ? "No assets match your filters"
              : "No assets yet"
          }
          description={
            hasActiveFilters(params)
              ? "Try a different search or clear the filters."
              : isAdmin
                ? "Add the first asset to start tracking equipment."
                : "Assets registered by the administrator will appear here."
          }
          action={
            hasActiveFilters(params) ? (
              <Link
                href={basePath}
                className={buttonClasses({ variant: "secondary" })}
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <AssetTable assets={rows} showEdit={isAdmin} />
          <Pagination
            page={params.page}
            pageSize={ASSETS_PAGE_SIZE}
            total={total}
            hrefFor={hrefFor}
            label="assets"
          />
        </>
      )}
    </>
  );
}
