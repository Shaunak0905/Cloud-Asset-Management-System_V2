import { FileText } from "lucide-react";

import type { FormState } from "@/lib/forms";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { fileHref, isImageType, UPLOAD_KINDS } from "@/lib/storage/files";
import type { Enums } from "@/types/database";

import { DeleteFileButton } from "./delete-file-button";
import { StoredImage } from "./stored-image";

export type EvidenceItem = {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  document_type: Enums<"document_type">;
  created_at: string;
  uploaded_by: string;
  uploader: { full_name: string } | null;
};

/**
 * Files attached to a maintenance request (docs/09 §30, §32–33): photos as
 * thumbnails, PDFs as links, each with its type, size, uploader and time.
 * Files open through the signed-URL route; storage paths are never shown.
 * Pass `deleteAction` (admins) to offer deletion.
 */
export function EvidenceList({
  files,
  viewerId,
  deleteAction,
}: {
  files: EvidenceItem[];
  viewerId: string;
  deleteAction?: (documentId: string) => () => Promise<FormState>;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-slate-600">No files attached yet.</p>;
  }

  return (
    <ul className="space-y-4" aria-label="Evidence">
      {files.map((file) => {
        const uploader =
          file.uploaded_by === viewerId ? "You" : file.uploader?.full_name;
        const image = isImageType(file.mime_type);
        return (
          <li key={file.id} className="flex items-start gap-3">
            <a
              href={fileHref(file.id)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              aria-label={`Open ${file.original_filename}`}
            >
              {image ? (
                <StoredImage
                  documentId={file.id}
                  alt={file.original_filename}
                  className="size-20 object-cover"
                />
              ) : (
                <span className="flex size-20 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
                  <FileText aria-hidden className="size-8" />
                </span>
              )}
            </a>
            <div className="min-w-0 flex-1">
              <a
                href={fileHref(file.id)}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-sm font-medium text-blue-700 hover:underline"
              >
                {file.original_filename}
              </a>
              <p className="text-sm text-slate-600">
                {UPLOAD_KINDS[file.document_type].label} ·{" "}
                {formatFileSize(file.file_size_bytes)}
              </p>
              <p className="text-xs text-slate-500">
                {uploader ? `${uploader} · ` : ""}
                <time dateTime={file.created_at}>
                  {formatDateTime(file.created_at)}
                </time>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3">
                <a
                  href={fileHref(file.id, true)}
                  className="text-sm text-blue-700 hover:underline"
                >
                  Download
                </a>
                {deleteAction && (
                  <DeleteFileButton
                    action={deleteAction(file.id)}
                    fileName={file.original_filename}
                  />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
