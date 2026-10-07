import type { AssetStatus } from "./status";

/**
 * Wording for the public QR page (docs/07-qr-system.md §20–22). Says what a
 * visitor needs to know and nothing more: never who has the asset, where it
 * is being used, or why it is in maintenance.
 */
export const PUBLIC_STATUS_MESSAGES: Record<
  AssetStatus,
  { headline: string; detail: string }
> = {
  AVAILABLE: {
    headline: "Available",
    detail: "This asset can be requested for use.",
  },
  ASSIGNED: {
    headline: "In use",
    detail: "This asset is currently in use.",
  },
  IN_MAINTENANCE: {
    headline: "Under maintenance",
    detail: "This asset is currently under maintenance.",
  },
  DAMAGED: {
    headline: "Damaged",
    detail: "This asset is damaged and not available for use.",
  },
  LOST: {
    headline: "Reported lost",
    detail:
      "If you have found this asset, please contact the campus administrator.",
  },
  RETIRED: {
    headline: "Retired",
    detail: "This asset is no longer available for use.",
  },
};
