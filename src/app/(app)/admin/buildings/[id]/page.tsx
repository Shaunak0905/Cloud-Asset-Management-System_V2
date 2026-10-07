import { DoorOpen } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AddRoomForm } from "@/components/locations/add-room-form";
import { BuildingForm } from "@/components/locations/building-form";
import { EditRoomButton } from "@/components/locations/edit-room-button";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import {
  createRoom,
  updateBuilding,
  updateRoom,
} from "@/lib/locations/actions";
import { getBuildingWithRooms } from "@/lib/locations/queries";
import { idSchema } from "@/lib/locations/schema";

export const metadata: Metadata = { title: "Manage building" };

export default async function BuildingPage({
  params,
}: PageProps<"/admin/buildings/[id]">) {
  await requireRole(["ADMIN"]);

  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const building = await getBuildingWithRooms(id);
  if (!building) notFound();

  const activeRooms = building.rooms.filter((room) => room.is_active).length;

  return (
    <>
      <BackLink href="/admin/buildings">All buildings</BackLink>
      <PageHeader
        title={building.name}
        description={`Code ${building.code} · ${activeRooms} active of ${building.rooms.length} rooms`}
        actions={
          <Badge tone={building.is_active ? "green" : "neutral"}>
            {building.is_active ? "Active" : "Inactive"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Building details" className="lg:col-span-1">
          <BuildingForm
            action={updateBuilding.bind(null, building.id)}
            building={building}
            submitLabel="Save changes"
          />
        </Card>

        <Card
          title="Rooms"
          description="Only active rooms appear in location pickers."
          className="lg:col-span-2"
        >
          <div className="space-y-4">
            <AddRoomForm action={createRoom.bind(null, building.id)} />

            {building.rooms.length === 0 ? (
              <EmptyState
                icon={DoorOpen}
                title="No rooms yet"
                description="Add the rooms in this building using the form above."
              />
            ) : (
              <Table caption={`Rooms in ${building.name}`}>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Room</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>
                      <span className="sr-only">Actions</span>
                    </TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {building.rooms.map((room) => (
                    <TableRow key={room.id}>
                      <TableCell className="font-mono font-medium whitespace-nowrap text-slate-900">
                        {room.room_number}
                      </TableCell>
                      <TableCell>{room.display_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge tone={room.is_active ? "green" : "neutral"}>
                          {room.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <EditRoomButton
                          room={room}
                          action={updateRoom.bind(null, room.id, building.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
