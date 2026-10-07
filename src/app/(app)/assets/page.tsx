import type { Metadata } from "next";

import { AssetListView } from "@/components/assets/asset-list-view";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { parseAssetListParams } from "@/lib/assets/schema";

export const metadata: Metadata = { title: "Assets" };

export default async function AssetsPage({
  searchParams,
}: PageProps<"/assets">) {
  await requireUser();
  const params = parseAssetListParams(await searchParams);

  return (
    <>
      <PageHeader
        title="Assets"
        description="Browse campus equipment. Open an asset to see its details and location."
      />
      <AssetListView basePath="/assets" params={params} />
    </>
  );
}
