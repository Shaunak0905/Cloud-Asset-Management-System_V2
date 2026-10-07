import type { Enums } from "@/types/database";

type AssetStatus = Enums<"asset_status">;

/** Final asset states a resolution can choose (docs/08 §27). */
export type ResolutionAssetState = "AVAILABLE" | "DAMAGED" | "RETIRED";

/**
 * The final asset states offered when resolving a request, or null when the
 * asset's status is left as it is (in use, lost or retired). Only admins may
 * retire. Mirrors private.resolution_asset_states
 * (tests/db/resolution.test.ts).
 */
export function resolutionAssetStates(
  assetStatus: AssetStatus,
  isAdmin: boolean,
): ResolutionAssetState[] | null {
  if (
    assetStatus !== "AVAILABLE" &&
    assetStatus !== "IN_MAINTENANCE" &&
    assetStatus !== "DAMAGED"
  ) {
    return null;
  }
  return isAdmin
    ? ["AVAILABLE", "DAMAGED", "RETIRED"]
    : ["AVAILABLE", "DAMAGED"];
}

export const RESOLUTION_STATE_OPTIONS: Record<
  ResolutionAssetState,
  { label: string; hint: string }
> = {
  AVAILABLE: {
    label: "Repaired",
    hint: "Back in service. It stays in maintenance if another serious problem is still open.",
  },
  DAMAGED: {
    label: "Still damaged",
    hint: "The work is finished, but the asset cannot be used.",
  },
  RETIRED: {
    label: "Beyond repair",
    hint: "Retire the asset. This cannot be undone.",
  },
};

/** Why the asset keeps its status when there is nothing to choose. */
export function unchangedAssetExplanation(assetStatus: AssetStatus): string {
  switch (assetStatus) {
    case "ASSIGNED":
      return "Someone is using this asset. It stays with them and goes back into use when it is returned.";
    case "LOST":
      return "The asset is marked lost; its status will not change.";
    case "RETIRED":
      return "The asset is retired; its status will not change.";
    default:
      return "The asset's status will not change.";
  }
}

/** Confirmation after resolving, from the asset's resulting status. */
export function resolvedMessage(finalStatus: AssetStatus | undefined): string {
  switch (finalStatus) {
    case "AVAILABLE":
      return "Request resolved. The asset is back in service.";
    case "IN_MAINTENANCE":
      return "Request resolved. The asset stays in maintenance because another serious problem is still open.";
    case "DAMAGED":
      return "Request resolved. The asset is marked damaged.";
    case "RETIRED":
      return "Request resolved. The asset has been retired.";
    case "ASSIGNED":
      return "Request resolved. The asset stays with the person using it.";
    default:
      return "Request resolved.";
  }
}
