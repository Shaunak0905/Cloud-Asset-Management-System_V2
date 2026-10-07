import { Building2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/current-user";
import { listBuildingsForAdmin } from "@/lib/locations/queries";

export const metadata: Metadata = { title: "Buildings & Rooms" };

export default async function AdminBuildingsPage() {
  await requireRole(["ADMIN"]);
  const buildings = await listBuildingsForAdmin();

  const addButton = (
    <Link href="/admin/buildings/new" className={buttonClasses()}>
      <Plus aria-hidden className="size-4" />
      Add building
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Buildings & Rooms"
        description="Campus locations used as asset homes and as usage locations."
        actions={buildings.length > 0 ? addButton : undefined}
      />

      {buildings.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No buildings yet"
          description="Add your first building, then add its rooms."
          action={addButton}
        />
      ) : (
        <Table caption="Buildings">
          <TableHead>
            <tr>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Rooms</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {buildings.map((building) => (
              <TableRow key={building.id}>
                <TableCell className="font-mono font-medium whitespace-nowrap text-slate-900">
                  {building.code}
                </TableCell>
                <TableCell>
                  <p className="font-medium text-slate-900">{building.name}</p>
                  {building.description && (
                    <p className="text-xs text-slate-500">
                      {building.description}
                    </p>
                  )}
                </TableCell>
                <TableCell>{building.roomCount}</TableCell>
                <TableCell>
                  <Badge tone={building.is_active ? "green" : "neutral"}>
                    {building.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/admin/buildings/${building.id}`}
                    className={buttonClasses({
                      variant: "secondary",
                      size: "sm",
                    })}
                  >
                    Manage<span className="sr-only"> {building.name}</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
