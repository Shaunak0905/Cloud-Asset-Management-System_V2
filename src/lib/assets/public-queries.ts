import "server-only";

import { cache } from "react";

import { PUBLIC_ID_PATTERN } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

/**
 * Safe public fields of one asset, via the get_public_asset database
 * function (works without signing in; never returns serial numbers,
 * assignments, maintenance data or internal IDs). Memoised per request so
 * metadata and page share one lookup. Null when no such asset exists.
 */
export const getPublicAsset = cache(async (publicId: string) => {
  if (!PUBLIC_ID_PATTERN.test(publicId)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_asset", {
    p_public_id: publicId,
  });
  if (error) {
    console.error(
      "[qr] public asset lookup failed:",
      error.code,
      error.message,
    );
    throw new Error("Unable to load this asset.");
  }
  return data?.[0] ?? null;
});

export type PublicAsset = NonNullable<
  Awaited<ReturnType<typeof getPublicAsset>>
>;
