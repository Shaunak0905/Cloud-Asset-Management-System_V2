import { createClient } from "@/lib/supabase/client";

import {
  type AllowedMimeType,
  type DocumentType,
  fileProblem,
  newStoragePath,
  SNIFF_BYTES,
  sniffMimeType,
  UPLOAD_KINDS,
} from "./files";
import { downscaleImage } from "./image";

/** What the browser tells the server about a file it uploaded. */
export type UploadedFile = {
  path: string;
  originalFilename: string;
  mimeType: AllowedMimeType;
  size: number;
};

export type UploadResult =
  { ok: true; file: UploadedFile } | { ok: false; message: string };

/**
 * Browser-side upload (docs/09 §12): shrink large photos, check type, size
 * and content, then send the file straight to its private bucket under a
 * generated path. Storage policies decide whether the signed-in user may
 * upload there; the caller then registers the file with a Server Action.
 * Errors are returned as messages for the user; raw storage errors are not
 * shown.
 */
export async function uploadFile(
  original: File,
  type: DocumentType,
  entityId: string,
): Promise<UploadResult> {
  const file = await downscaleImage(original);

  const problem = fileProblem(file, type);
  if (problem) return { ok: false, message: problem };

  // The content must match the declared type (a renamed file does not).
  const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
  const mimeType = sniffMimeType(head);
  if (mimeType !== file.type) {
    return {
      ok: false,
      message: `This file is not a valid ${UPLOAD_KINDS[type].accepts} file.`,
    };
  }

  const path = newStoragePath(type, entityId, mimeType);
  const { error } = await createClient()
    .storage.from(UPLOAD_KINDS[type].bucket)
    .upload(path, file, { contentType: mimeType, upsert: false });
  if (error) {
    console.error("[storage] upload failed:", error.message);
    return { ok: false, message: "Upload failed. Please try again." };
  }

  return {
    ok: true,
    file: {
      path,
      originalFilename: original.name,
      mimeType,
      size: file.size,
    },
  };
}
