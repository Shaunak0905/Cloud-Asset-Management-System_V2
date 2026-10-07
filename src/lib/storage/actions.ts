"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assetIdParam } from "@/lib/assets/schema";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import { isPermissionError, PG_CHECK_VIOLATION } from "@/lib/db-errors";
import type { FormState } from "@/lib/forms";
import { requestNumberParam } from "@/lib/maintenance/schema";
import { createClient } from "@/lib/supabase/server";

import {
  type AllowedMimeType,
  type DocumentType,
  EVIDENCE_TYPES,
  IMAGE_MIME_TYPES,
  isAllowedFor,
  isStoragePathFor,
  MAX_FILE_BYTES,
  PDF_MIME_TYPES,
  safeDisplayName,
  SNIFF_BYTES,
  sniffMimeType,
  UPLOAD_KINDS,
} from "./files";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const UPLOAD_FAILED = "Upload failed. Please try again.";
const FILE_GONE = "This file no longer exists.";

/** What the browser reports after uploading; every field is re-checked. */
const uploadSchema = z.object({
  path: z.string().min(1).max(512),
  originalFilename: z.string().max(1000),
  mimeType: z.enum([...IMAGE_MIME_TYPES, ...PDF_MIME_TYPES]),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
});

function failed(message: string): FormState {
  return { status: "error", message };
}

/** Best-effort removal; a failure is logged for administrative cleanup. */
async function removeObject(supabase: Supabase, bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error("[storage] could not remove", bucket, path, error.message);
  }
}

/** The content check must never hold a request up for long. */
const VERIFY_TIMEOUT_MS = 10_000;

/**
 * Reads the first bytes of the stored object (through a short-lived signed
 * URL) and checks that they are really of the declared type, so a renamed
 * file is not accepted just because the browser said "image/jpeg".
 * "unknown" means the file could not be read (missing, or storage is slow).
 */
async function checkStoredContent(
  supabase: Supabase,
  bucket: string,
  path: string,
  mimeType: AllowedMimeType,
): Promise<"match" | "mismatch" | "unknown"> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60);
  if (error || !data) {
    console.error("[storage] could not sign", bucket, path, error?.message);
    return "unknown";
  }

  try {
    const response = await fetch(data.signedUrl, {
      headers: { Range: `bytes=0-${SNIFF_BYTES - 1}` },
      cache: "no-store",
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
    const reader = response.ok ? response.body?.getReader() : undefined;
    if (!reader) return "unknown";
    // Only the first chunk is needed, even if the range was ignored.
    const { value } = await reader.read();
    // Deliberately not awaited: Next.js keeps its own copy of a fetched
    // body, and cancel() only settles once every copy is released — which
    // never happens here, so awaiting it would hang the request forever.
    void reader.cancel().catch(() => {});
    if (!value) return "unknown";
    return sniffMimeType(value) === mimeType ? "match" : "mismatch";
  } catch (cause) {
    console.error("[storage] could not verify", bucket, path, cause);
    return "unknown";
  }
}

/**
 * Registers a file the browser uploaded: checks the reported path, type and
 * content, then inserts its asset_documents row. The database repeats the
 * checks (RLS, path ownership, the stored object's real type and size). If
 * anything fails, the uploaded object is removed so no orphan is left.
 */
async function registerUpload(
  supabase: Supabase,
  type: DocumentType,
  target: { assetUuid: string } | { requestId: string },
  rawUpload: unknown,
): Promise<{ id: string } | FormState> {
  const kind = UPLOAD_KINDS[type];
  const entityId = "assetUuid" in target ? target.assetUuid : target.requestId;

  const parsed = uploadSchema.safeParse(rawUpload);
  if (
    !parsed.success ||
    !isAllowedFor(type, parsed.data.mimeType) ||
    !isStoragePathFor(parsed.data.path, type, entityId, parsed.data.mimeType)
  ) {
    return failed(UPLOAD_FAILED);
  }
  const upload = parsed.data;

  const content = await checkStoredContent(
    supabase,
    kind.bucket,
    upload.path,
    upload.mimeType,
  );
  if (content !== "match") {
    await removeObject(supabase, kind.bucket, upload.path);
    return failed(
      content === "mismatch"
        ? `This file is not a valid ${kind.accepts} file.`
        : UPLOAD_FAILED,
    );
  }

  const { data, error } = await supabase
    .from("asset_documents")
    .insert({
      ...("assetUuid" in target
        ? { asset_id: target.assetUuid }
        : { maintenance_request_id: target.requestId }),
      bucket_name: kind.bucket,
      storage_path: upload.path,
      original_filename: safeDisplayName(upload.originalFilename),
      mime_type: upload.mimeType,
      file_size_bytes: upload.size,
      document_type: type,
    })
    .select("id")
    .single();

  if (error) {
    await removeObject(supabase, kind.bucket, upload.path);
    if (isPermissionError(error)) {
      return failed(
        "You are not allowed to add files here, or the request is closed.",
      );
    }
    if (error.code === PG_CHECK_VIOLATION) {
      return failed("This file's type or size is not accepted.");
    }
    console.error("[storage] register failed:", error.code, error.message);
    return failed(UPLOAD_FAILED);
  }
  return data;
}

/** Deletes a file's metadata, then its object (metadata first: see below). */
async function deleteDocumentAndObject(
  supabase: Supabase,
  document: { id: string; bucket_name: string; storage_path: string },
): Promise<boolean> {
  // If the object removal fails afterwards, only an invisible orphan remains
  // (logged); the reverse order could leave a listed file that cannot open.
  const { error, count } = await supabase
    .from("asset_documents")
    .delete({ count: "exact" })
    .eq("id", document.id);
  if (error || !count) {
    if (error) {
      console.error("[storage] delete failed:", error.code, error.message);
    }
    return false;
  }
  await removeObject(supabase, document.bucket_name, document.storage_path);
  return true;
}

/**
 * Admin: registers a new photo for an asset and removes the photo it
 * replaces — only after the new one is safely registered (docs/09 §27).
 */
export async function registerAssetImage(
  assetUuid: string,
  assetId: string,
  type: DocumentType,
  upload: unknown,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  if (
    !z.uuid().safeParse(assetUuid).success ||
    !assetIdParam.safeParse(assetId).success ||
    type !== "ASSET_IMAGE"
  ) {
    return failed(UPLOAD_FAILED);
  }

  const supabase = await createClient();
  const result = await registerUpload(supabase, type, { assetUuid }, upload);
  if (!("id" in result)) return result;

  const { data: previous } = await supabase
    .from("asset_documents")
    .select("id, bucket_name, storage_path")
    .eq("asset_id", assetUuid)
    .eq("document_type", "ASSET_IMAGE")
    .neq("id", result.id);
  for (const document of previous ?? []) {
    await deleteDocumentAndObject(supabase, document);
  }

  revalidatePath(`/assets/${assetId}`);
  return { status: "success", savedAt: Date.now() };
}

/**
 * Registers evidence (a photo or PDF) for a maintenance request. RLS allows
 * admins, and the assigned technician while the request is assigned or in
 * progress; the uploader is taken from the session.
 */
export async function registerEvidence(
  requestId: string,
  requestNumber: string,
  type: DocumentType,
  upload: unknown,
): Promise<FormState> {
  await requireUser();
  if (
    !z.uuid().safeParse(requestId).success ||
    !requestNumberParam.safeParse(requestNumber).success ||
    !(EVIDENCE_TYPES as readonly DocumentType[]).includes(type)
  ) {
    return failed(UPLOAD_FAILED);
  }

  const supabase = await createClient();
  const result = await registerUpload(supabase, type, { requestId }, upload);
  if (!("id" in result)) return result;

  revalidatePath(`/maintenance/${requestNumber}`);
  return { status: "success", savedAt: Date.now() };
}

/**
 * Admin: deletes a file (an asset photo, or inappropriate evidence). The
 * deletion is audited by the database. `assetId` / `requestNumber` say which
 * page to refresh.
 */
export async function deleteDocument(
  documentId: string,
  assetId: string,
  requestNumber: string | null,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  if (
    !z.uuid().safeParse(documentId).success ||
    !assetIdParam.safeParse(assetId).success ||
    (requestNumber !== null &&
      !requestNumberParam.safeParse(requestNumber).success)
  ) {
    return failed(FILE_GONE);
  }

  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("asset_documents")
    .select("id, bucket_name, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (error) {
    console.error("[storage] delete lookup failed:", error.code, error.message);
    return failed("Unable to delete the file. Please try again.");
  }
  if (!document) return failed(FILE_GONE);

  if (!(await deleteDocumentAndObject(supabase, document))) {
    return failed("Unable to delete the file. Please try again.");
  }

  revalidatePath(`/assets/${assetId}`);
  if (requestNumber) revalidatePath(`/maintenance/${requestNumber}`);
  return { status: "success", savedAt: Date.now() };
}
