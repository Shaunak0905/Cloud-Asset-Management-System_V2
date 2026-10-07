// One-time success messages shown after a redirect (?toast=<code>). Only
// these fixed codes are recognised, so a crafted URL cannot display
// arbitrary text.

export const FLASH_MESSAGES = {
  "building-created": "Building created.",
  "asset-created": "Asset created.",
  "asset-updated": "Asset updated.",
  "asset-requested": "Assignment created. The asset is now assigned to you.",
  "asset-assigned": "Asset assigned.",
  "asset-transferred":
    "Asset transferred. The previous assignment is kept in its history.",
  "problem-reported": "Problem reported. You can follow its progress here.",
} as const;

export type FlashCode = keyof typeof FLASH_MESSAGES;

export const FLASH_PARAM = "toast";

export function withFlash(path: string, code: FlashCode): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${FLASH_PARAM}=${code}`;
}

export function flashMessage(code: string | null): string | null {
  return code && Object.hasOwn(FLASH_MESSAGES, code)
    ? FLASH_MESSAGES[code as FlashCode]
    : null;
}
