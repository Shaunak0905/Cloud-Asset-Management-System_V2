import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetForm } from "@/components/assets/asset-form";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateAsset } from "@/lib/assets/actions";
import { COMMON_DEPARTMENTS } from "@/lib/assets/constants";
import {
  getAssetByAssetId,
  listDepartments,
  listRoomsForEdit,
} from "@/lib/assets/queries";
import { assetIdParam } from "@/lib/assets/schema";
import { requireRole } from "@/lib/auth/current-user";
import { campusToday } from "@/lib/format";
import { listActiveBuildings } from "@/lib/locations/queries";

export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({
  params,
}: PageProps<"/admin/assets/[assetId]/edit">) {
  await requireRole(["ADMIN"]);

  const { assetId } = await params;
  if (!assetIdParam.safeParse(assetId).success) notFound();
  const asset = await getAssetByAssetId(assetId);
  if (!asset) notFound();

  const [activeBuildings, departments, rooms] = await Promise.all([
    listActiveBuildings(),
    listDepartments(),
    listRoomsForEdit(asset.registered_building_id, asset.registered_room_id),
  ]);

  // Keep the current building selectable even if it has been deactivated.
  const buildings =
    asset.buildings &&
    !activeBuildings.some((b) => b.id === asset.buildings!.id)
      ? [...activeBuildings, asset.buildings]
      : activeBuildings;

  return (
    <div className="max-w-3xl">
      <BackLink href={`/assets/${asset.asset_id}`}>Back to asset</BackLink>
      <PageHeader title={`Edit ${asset.name}`} description={asset.asset_id} />
      <Card>
        <AssetForm
          action={updateAsset.bind(null, asset.id)}
          buildings={buildings}
          departmentSuggestions={[
            ...new Set([...COMMON_DEPARTMENTS, ...departments]),
          ].sort()}
          defaults={{
            name: asset.name,
            category: asset.category,
            serialNumber: asset.serial_number ?? "",
            department: asset.department ?? "",
            buildingId: asset.registered_building_id,
            roomId: asset.registered_room_id,
            purchaseDate: asset.purchase_date ?? "",
            warrantyUntil: asset.warranty_until ?? "",
            description: asset.description ?? "",
          }}
          initialRooms={rooms}
          today={campusToday()}
          submitLabel="Save changes"
          cancelHref={`/assets/${asset.asset_id}`}
        />
      </Card>
    </div>
  );
}
