import type { Metadata } from "next";

import { AssetForm } from "@/components/assets/asset-form";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createAsset } from "@/lib/assets/actions";
import { COMMON_DEPARTMENTS } from "@/lib/assets/constants";
import { listDepartments } from "@/lib/assets/queries";
import { requireRole } from "@/lib/auth/current-user";
import { campusToday } from "@/lib/format";
import { listActiveBuildings } from "@/lib/locations/queries";

export const metadata: Metadata = { title: "Add asset" };

export default async function NewAssetPage() {
  await requireRole(["ADMIN"]);
  const [buildings, departments] = await Promise.all([
    listActiveBuildings(),
    listDepartments(),
  ]);

  return (
    <div className="max-w-3xl">
      <BackLink href="/admin/assets">All assets</BackLink>
      <PageHeader
        title="Add asset"
        description="The asset ID and QR identity are generated when you save."
      />
      <Card>
        <AssetForm
          action={createAsset}
          buildings={buildings}
          departmentSuggestions={[
            ...new Set([...COMMON_DEPARTMENTS, ...departments]),
          ].sort()}
          today={campusToday()}
          submitLabel="Create asset"
          cancelHref="/admin/assets"
        />
      </Card>
    </div>
  );
}
