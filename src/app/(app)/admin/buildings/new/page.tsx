import type { Metadata } from "next";

import { BuildingForm } from "@/components/locations/building-form";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/current-user";
import { createBuilding } from "@/lib/locations/actions";

export const metadata: Metadata = { title: "Add building" };

export default async function NewBuildingPage() {
  await requireRole(["ADMIN"]);

  return (
    <div className="max-w-2xl">
      <BackLink href="/admin/buildings">All buildings</BackLink>
      <PageHeader
        title="Add building"
        description="You can add the building's rooms on the next page."
      />
      <Card>
        <BuildingForm
          action={createBuilding}
          submitLabel="Create building"
          cancelHref="/admin/buildings"
        />
      </Card>
    </div>
  );
}
