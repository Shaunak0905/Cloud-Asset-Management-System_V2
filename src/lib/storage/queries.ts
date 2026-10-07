import "server-only";

import { createClient } from "@/lib/supabase/server";

// File metadata. RLS decides what is visible: asset photos to every active
// user; maintenance evidence to admins and the assigned technician.
// (Select strings stay single literals so the typed client can infer rows.)

function loadError(what: string, error: { code?: string; message: string }) {
  console.error(`[storage] failed to load ${what}:`, error.code, error.message);
  return new Error(`Unable to load ${what}.`);
}

/** The asset's current photo (its newest one), or null. */
export async function getAssetImage(assetUuid: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_documents")
    .select("id, original_filename, created_at")
    .eq("asset_id", assetUuid)
    .eq("document_type", "ASSET_IMAGE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw loadError("asset photo", error);
  return data;
}

/** Most files a request page lists; real requests stay far below. */
const EVIDENCE_LIMIT = 100;

/** Files attached to a maintenance request, oldest first. */
export async function listEvidence(requestId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_documents")
    .select(
      "id, original_filename, mime_type, file_size_bytes, document_type, created_at, uploaded_by, uploader:profiles!asset_documents_uploaded_by_fkey(full_name)",
    )
    .eq("maintenance_request_id", requestId)
    .order("created_at", { ascending: true })
    .limit(EVIDENCE_LIMIT);
  if (error) throw loadError("evidence", error);
  return data;
}

export type EvidenceFile = Awaited<ReturnType<typeof listEvidence>>[number];
