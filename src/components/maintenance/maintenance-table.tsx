import Link from "next/link";

import {
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/status-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { locationLabel } from "@/lib/locations/types";
import type { Enums } from "@/types/database";

export type MaintenanceRow = {
  id: string;
  request_number: string;
  status: Enums<"maintenance_status">;
  priority: Enums<"maintenance_priority">;
  created_at: string;
  assets: {
    asset_id: string;
    name: string;
    buildings?: { name: string } | null;
    rooms?: { room_number: string } | null;
  } | null;
  technician?: { full_name: string | null; email: string | null } | null;
};

/**
 * Maintenance requests (docs/10 §20). Pass `showTechnician` for admin views
 * and `showLocation` (the asset's home location) for technicians (docs/08 §14).
 */
export function MaintenanceTable({
  rows,
  caption,
  showTechnician = false,
  showLocation = false,
}: {
  rows: MaintenanceRow[];
  caption: string;
  showTechnician?: boolean;
  showLocation?: boolean;
}) {
  return (
    <Table caption={caption}>
      <TableHead>
        <tr>
          <TableHeaderCell>Request</TableHeaderCell>
          <TableHeaderCell>Asset</TableHeaderCell>
          {showLocation && <TableHeaderCell>Location</TableHeaderCell>}
          <TableHeaderCell>Priority</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          {showTechnician && <TableHeaderCell>Technician</TableHeaderCell>}
          <TableHeaderCell>Reported</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="whitespace-nowrap">
              <Link
                href={`/maintenance/${row.request_number}`}
                className="font-mono font-medium text-blue-700 hover:underline"
              >
                {row.request_number}
              </Link>
            </TableCell>
            <TableCell>
              <p className="font-medium text-slate-900">{row.assets?.name}</p>
              <p className="font-mono text-xs text-slate-500">
                {row.assets?.asset_id}
              </p>
            </TableCell>
            {showLocation && (
              <TableCell className="whitespace-nowrap">
                {locationLabel(row.assets?.buildings, row.assets?.rooms)}
              </TableCell>
            )}
            <TableCell>
              <PriorityBadge priority={row.priority} />
            </TableCell>
            <TableCell>
              <MaintenanceStatusBadge status={row.status} />
            </TableCell>
            {showTechnician && (
              <TableCell className="whitespace-nowrap">
                {row.technician ? (
                  (row.technician.full_name ?? row.technician.email)
                ) : (
                  <span className="text-slate-500">Not assigned</span>
                )}
              </TableCell>
            )}
            <TableCell className="whitespace-nowrap">
              {formatDateTime(row.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
