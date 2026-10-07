"use client";

import { Download, Printer } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/loading";
import { QR_OPTIONS, qrFileName } from "@/lib/qr";

/** Pixel width of the generated PNG: sharp enough to print at label size. */
const PNG_WIDTH = 1024;

type AssetQrCodeProps = {
  /** The full public asset URL the code encodes. */
  url: string;
  publicId: string;
  /** Displayed size in CSS pixels. */
  size?: number;
  /** Show download/print controls (admin QR panel). */
  withActions?: boolean;
  printHref?: string;
};

/**
 * Generates the asset's QR code in the browser from its public URL (no QR
 * service, nothing stored). The same URL always yields the same code, so
 * reprinting a damaged sticker gives an identical label.
 */
export function AssetQrCode({
  url,
  publicId,
  size = 192,
  withActions = false,
  printHref,
}: AssetQrCodeProps) {
  const [generated, setGenerated] = useState<{
    url: string;
    png: string;
  } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(url, { ...QR_OPTIONS, width: PNG_WIDTH }).then(
      (png) => {
        if (current) setGenerated({ url, png });
      },
      (error: unknown) => {
        console.error("[qr] generation failed:", error);
        if (current) setFailedUrl(url);
      },
    );
    return () => {
      current = false;
    };
  }, [url]);

  const png = generated?.url === url ? generated.png : null;

  if (failedUrl === url) {
    return (
      <Alert tone="error" title="Unable to generate QR code">
        Please reload the page and try again.
      </Alert>
    );
  }

  async function downloadSvg() {
    try {
      const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: "svg" });
      const href = URL.createObjectURL(
        new Blob([svg], { type: "image/svg+xml" }),
      );
      const link = document.createElement("a");
      link.href = href;
      link.download = qrFileName(publicId, "svg");
      link.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      console.error("[qr] SVG download failed:", error);
      setFailedUrl(url);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {png ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data URL, not an optimisable asset
        <img
          src={png}
          alt={`QR code for asset ${publicId}`}
          width={size}
          height={size}
          className="rounded-md bg-white [image-rendering:pixelated]"
        />
      ) : (
        <div role="status" style={{ width: size, height: size }}>
          <span className="sr-only">Generating QR code…</span>
          <Skeleton className="size-full" />
        </div>
      )}

      {withActions && (
        <div className="flex flex-wrap justify-center gap-2">
          {png ? (
            <a
              href={png}
              download={qrFileName(publicId, "png")}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Download aria-hidden className="size-4" />
              PNG
            </a>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              <Download aria-hidden className="size-4" />
              PNG
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={downloadSvg}>
            <Download aria-hidden className="size-4" />
            SVG
          </Button>
          {printHref && (
            <Link
              href={printHref}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Printer aria-hidden className="size-4" />
              Print label
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
