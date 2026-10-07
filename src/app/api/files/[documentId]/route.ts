import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseConfig } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Long enough to start a download, short enough that a copied link is useless. */
const SIGNED_URL_SECONDS = 60;
const NO_STORE = { "Cache-Control": "private, no-store" };

function unavailable() {
  return new NextResponse("File unavailable.", {
    status: 404,
    headers: NO_STORE,
  });
}

/**
 * Opens a stored file (docs/09 §28–29). The buckets are private, so this
 * looks the file up as the signed-in user — RLS on asset_documents decides
 * whether they may see it — and redirects to a signed URL that expires in a
 * minute. Pages link here by document id, so links never go stale and
 * storage paths are not part of the app's URLs. `?download=1` saves the
 * file under its original name instead of opening it.
 *
 * Unknown ids, files the user may not see, signed-out users and objects
 * missing from storage all get the same 404.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/files/[documentId]">,
) {
  const { documentId } = await context.params;
  if (!z.uuid().safeParse(documentId).success || !getSupabaseConfig().ok) {
    return unavailable();
  }

  const supabase = await createClient();
  const { data: document } = await supabase
    .from("asset_documents")
    .select("bucket_name, storage_path, original_filename")
    .eq("id", documentId)
    .maybeSingle();
  if (!document) return unavailable();

  const download = request.nextUrl.searchParams.has("download");
  const { data, error } = await supabase.storage
    .from(document.bucket_name)
    .createSignedUrl(document.storage_path, SIGNED_URL_SECONDS, {
      download: download ? document.original_filename : false,
    });
  if (error || !data) {
    console.error("[files] could not sign", documentId, error?.message);
    return unavailable();
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 307,
    headers: NO_STORE,
  });
}
