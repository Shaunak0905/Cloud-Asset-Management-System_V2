// QR identity (docs/07-qr-system.md). A QR code encodes only the asset's
// public URL: no secrets, no private data, no state. The URL depends solely
// on the public ID, so reprinting always produces the same code.

/** Error correction "Q" (~25%) keeps stickers readable when scuffed. */
export const QR_OPTIONS = {
  errorCorrectionLevel: "Q",
  /** The standard 4-module quiet zone around the code. */
  margin: 4,
} as const;

/** The one place asset URLs are built: `<appUrl>/asset/<publicId>`. */
export function getAssetPublicUrl(appUrl: string, publicId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/asset/${encodeURIComponent(publicId)}`;
}

/** Deterministic, safe download name, e.g. asset-qr-AST-2026-00142.png */
export function qrFileName(publicId: string, extension: "png" | "svg"): string {
  return `asset-qr-${publicId.replace(/[^A-Za-z0-9-]/g, "")}.${extension}`;
}

/**
 * True for addresses a phone elsewhere cannot reach. Physical labels must be
 * printed from the production domain (docs/15 §12), never from these.
 */
export function isLocalAddress(url: string): boolean {
  const { hostname } = new URL(url);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/** Public IDs in URLs (matches the assets_public_id_format constraint). */
export const PUBLIC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/;
