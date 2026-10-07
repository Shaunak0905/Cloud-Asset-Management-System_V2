// Must match the assets_category_valid check constraint
// (tests/db/assets.test.ts fails if they drift apart).
export const ASSET_CATEGORIES = [
  "Projector",
  "Laptop",
  "Desktop",
  "Camera",
  "Oscilloscope",
  "Arduino Kit",
  "Raspberry Pi",
  "Printer",
  "Networking Equipment",
  "Lab Equipment",
  "Other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/** Suggestions for the department field; any department may be typed. */
export const COMMON_DEPARTMENTS = [
  "Administration",
  "Civil",
  "Computer Science",
  "Electronics",
  "Library",
  "Mechanical",
] as const;

export const ASSETS_PAGE_SIZE = 20;
