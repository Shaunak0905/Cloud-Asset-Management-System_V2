import Link from "next/link";

import { AssetStatusBadge } from "@/components/status-badges";
import { buttonClasses } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import type { AssetListRow } from "@/lib/assets/queries";
import { locationLabel } from "@/lib/locations/types";

export function AssetTable({
  assets,
  showEdit = false,
}: {
  assets: AssetListRow[];
  /** Admin view: adds an Edit link per row. */
  showEdit?: boolean;
}) {
  return (
    <Table caption="Assets">
      <TableHead>
        <tr>
          <TableHeaderCell>Asset ID</TableHeaderCell>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell>Category</TableHeaderCell>
          <TableHeaderCell>Registered location</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          {showEdit && (
            <TableHeaderCell>
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          )}
        </tr>
      </TableHead>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="font-mono whitespace-nowrap">
              <Link
                href={`/assets/${asset.asset_id}`}
                className="font-medium text-blue-700 hover:underline"
              >
                {asset.asset_id}
              </Link>
            </TableCell>
            <TableCell>
              <p className="font-medium text-slate-900">{asset.name}</p>
              {asset.department && (
                <p className="text-xs text-slate-500">{asset.department}</p>
              )}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {asset.category}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {locationLabel(asset.buildings, asset.rooms)}
            </TableCell>
            <TableCell>
              <AssetStatusBadge status={asset.status} />
            </TableCell>
            {showEdit && (
              <TableCell className="text-right">
                <Link
                  href={`/admin/assets/${asset.asset_id}/edit`}
                  className={buttonClasses({
                    variant: "secondary",
                    size: "sm",
                  })}
                >
                  Edit<span className="sr-only"> {asset.asset_id}</span>
                </Link>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
