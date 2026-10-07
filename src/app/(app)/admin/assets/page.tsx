import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AssetListView } from "@/components/assets/asset-list-view";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/current-user";
import { parseAssetListParams } from "@/lib/assets/schema";

export const metadata: Metadata = { title: "Manage assets" };

export default async function AdminAssetsPage({
  searchParams,
}: PageProps<"/admin/assets">) {
  await requireRole(["ADMIN"]);
  const params = parseAssetListParams(await searchParams);

  return (
    <>
      <PageHeader
        title="Assets"
        description="Create, edit and retire campus assets."
        actions={
          <Link href="/admin/assets/new" className={buttonClasses()}>
            <Plus aria-hidden className="size-4" />
            Add asset
          </Link>
        }
      />
      <AssetListView basePath="/admin/assets" params={params} isAdmin />
    </>
  );
}
