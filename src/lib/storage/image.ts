import { isImageType } from "./files";

/** Photos at or below this size are uploaded as they are. */
const KEEP_BELOW_BYTES = 1.5 * 1024 * 1024;
/** Longest edge after downscaling: enough to identify damage or a label. */
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

/**
 * Shrinks a large photo in the browser before upload (docs/09 §39): phone
 * cameras produce 4–12 MB images, which would waste free-tier storage. Small
 * images, non-images and anything the browser cannot process are returned
 * unchanged, as is the original when the result would not be smaller.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!isImageType(file.type) || file.size <= KEEP_BELOW_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;

    // JPEG has no transparency: put transparent PNG/WebP on white.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]*$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
