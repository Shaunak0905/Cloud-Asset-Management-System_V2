"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";

import { fileHref } from "@/lib/storage/files";
import { cn } from "@/lib/utils/cn";

/**
 * A stored image, loaded through the signed-URL route. If the file cannot
 * be loaded (deleted from storage, or access was withdrawn) it shows
 * "Image unavailable" instead of a broken image (docs/09 §35).
 */
export function StoredImage({
  documentId,
  alt,
  className,
}: {
  documentId: string;
  alt: string;
  className?: string;
}) {
  // Keyed by document so a replaced photo gets a fresh attempt.
  const [failedId, setFailedId] = useState<string | null>(null);

  if (failedId === documentId) {
    return (
      <div
        role="img"
        aria-label={`${alt} (unavailable)`}
        className={cn(
          "flex min-h-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 p-1 text-center text-xs leading-tight text-slate-500",
          className,
        )}
      >
        <ImageOff aria-hidden className="size-4 shrink-0" />
        Image unavailable
      </div>
    );
  }

  return (
    // A plain <img>: the source is a private, short-lived signed URL, which
    // must not go through the shared image optimizer cache.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={fileHref(documentId)}
      alt={alt}
      loading="lazy"
      onError={() => setFailedId(documentId)}
      className={cn(
        "rounded-md border border-slate-200 bg-slate-50",
        className,
      )}
    />
  );
}
