import type { Enums } from "@/types/database";

// File rules shared by the browser (before upload) and the server (when a
// file is registered). The storage buckets and asset_documents constraints
// enforce the same limits (supabase/migrations/…_storage.sql).

export type DocumentType = Enums<"document_type">;

/** 10 MB per file (docs/09 §14). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const PDF_MIME_TYPES = ["application/pdf"] as const;

export type AllowedMimeType =
  (typeof IMAGE_MIME_TYPES)[number] | (typeof PDF_MIME_TYPES)[number];

/** Extension of the generated object name; original names are never used. */
export const FILE_EXTENSIONS: Record<AllowedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type StorageBucket =
  "asset-images" | "maintenance-images" | "maintenance-documents";

type UploadKind = {
  label: string;
  bucket: StorageBucket;
  /** First path segment: files of an asset or of a maintenance request. */
  folder: "assets" | "maintenance";
  mimeTypes: readonly AllowedMimeType[];
  /** Shown next to the file picker. */
  accepts: string;
};

/**
 * What each document type is, where it is stored and which files it takes.
 * Keyed by the database enum, so a new type without rules is a type error.
 */
export const UPLOAD_KINDS: Record<DocumentType, UploadKind> = {
  ASSET_IMAGE: {
    label: "Asset photo",
    bucket: "asset-images",
    folder: "assets",
    mimeTypes: IMAGE_MIME_TYPES,
    accepts: "JPG, PNG or WebP",
  },
  MAINTENANCE_IMAGE: {
    label: "Photo",
    bucket: "maintenance-images",
    folder: "maintenance",
    mimeTypes: IMAGE_MIME_TYPES,
    accepts: "JPG, PNG or WebP",
  },
  SERVICE_REPORT: {
    label: "Service report",
    bucket: "maintenance-documents",
    folder: "maintenance",
    mimeTypes: PDF_MIME_TYPES,
    accepts: "PDF",
  },
  RECEIPT: {
    label: "Receipt",
    bucket: "maintenance-documents",
    folder: "maintenance",
    mimeTypes: PDF_MIME_TYPES,
    accepts: "PDF",
  },
  OTHER: {
    label: "Other document",
    bucket: "maintenance-documents",
    folder: "maintenance",
    mimeTypes: PDF_MIME_TYPES,
    accepts: "PDF",
  },
};

/** Evidence types offered on a maintenance request, photos first. */
export const EVIDENCE_TYPES = [
  "MAINTENANCE_IMAGE",
  "SERVICE_REPORT",
  "RECEIPT",
  "OTHER",
] as const satisfies readonly DocumentType[];

export function isImageType(mimeType: string): boolean {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isAllowedFor(
  type: DocumentType,
  mimeType: string,
): mimeType is AllowedMimeType {
  return (UPLOAD_KINDS[type].mimeTypes as readonly string[]).includes(mimeType);
}

/**
 * Checks a file's declared type and size for a document type. Returns a
 * message for the user, or null when the file is acceptable.
 */
export function fileProblem(
  file: { type: string; size: number },
  type: DocumentType,
): string | null {
  const kind = UPLOAD_KINDS[type];
  if (!isAllowedFor(type, file.type)) {
    return `Choose a ${kind.accepts} file.`;
  }
  if (file.size <= 0) return "This file is empty.";
  if (file.size > MAX_FILE_BYTES) {
    return "This file is larger than 10 MB.";
  }
  return null;
}

/** How many leading bytes sniffMimeType needs. */
export const SNIFF_BYTES = 12;

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * The file type according to its first bytes, or null if it is none of the
 * allowed types. A renamed file keeps its real signature, so this catches
 * e.g. an executable called photo.jpg (docs/09 §41).
 */
export function sniffMimeType(bytes: Uint8Array): AllowedMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // "RIFF" <size> "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  // "%PDF-"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return "application/pdf";
  return null;
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * A new object path: <folder>/<entity uuid>/<random uuid>.<ext>. The name is
 * generated, so user-chosen file names never reach storage paths.
 */
export function newStoragePath(
  type: DocumentType,
  entityId: string,
  mimeType: AllowedMimeType,
): string {
  const { folder } = UPLOAD_KINDS[type];
  return `${folder}/${entityId}/${crypto.randomUUID()}.${FILE_EXTENSIONS[mimeType]}`;
}

/**
 * True if `path` is a generated path for this entity, document type and
 * file type. The server checks this before registering a client's upload.
 */
export function isStoragePathFor(
  path: string,
  type: DocumentType,
  entityId: string,
  mimeType: AllowedMimeType,
): boolean {
  const { folder } = UPLOAD_KINDS[type];
  const pattern = new RegExp(
    `^${folder}/(${UUID})/${UUID}\\.${FILE_EXTENSIONS[mimeType]}$`,
  );
  return pattern.exec(path)?.[1] === entityId.toLowerCase();
}

/**
 * The app route that opens a file by redirecting to a short-lived signed URL
 * (src/app/api/files/[documentId]/route.ts).
 */
export function fileHref(documentId: string, download = false): string {
  return `/api/files/${documentId}${download ? "?download=1" : ""}`;
}

/** The name shown for a file: no directories, no control characters. */
export function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/\p{Cc}/gu, "")
    .trim()
    .slice(0, 255);
  return cleaned || "file";
}
