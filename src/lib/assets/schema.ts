import { z } from "zod";

import { campusToday } from "@/lib/format";
import { optionalDate, optionalText, requiredId } from "@/lib/forms";
import { Constants } from "@/types/database";

import { ASSET_CATEGORIES, type AssetCategory } from "./constants";
import type { AssetStatus } from "./status";

// --- Asset form ------------------------------------------------------------------

export const ASSET_FORM_FIELDS = [
  "name",
  "category",
  "serialNumber",
  "department",
  "buildingId",
  "roomId",
  "purchaseDate",
  "warrantyUntil",
  "description",
] as const;

/** Mirrors the assets table constraints; `today` is the campus date. */
export function assetFormSchema(today: string = campusToday()) {
  return z
    .object({
      name: z
        .string()
        .trim()
        .min(1, "Enter the asset name.")
        .max(200, "Asset name must be 200 characters or fewer."),
      category: z.enum(ASSET_CATEGORIES, "Choose a category."),
      serialNumber: optionalText(100, "Serial number"),
      department: optionalText(100, "Department"),
      buildingId: requiredId("Select a building."),
      roomId: requiredId("Select a room."),
      purchaseDate: optionalDate,
      warrantyUntil: optionalDate,
      description: optionalText(2000, "Description"),
    })
    .superRefine((asset, ctx) => {
      if (asset.purchaseDate && asset.purchaseDate > today) {
        ctx.addIssue({
          code: "custom",
          path: ["purchaseDate"],
          message: "Purchase date cannot be in the future.",
        });
      }
      if (
        asset.purchaseDate &&
        asset.warrantyUntil &&
        asset.warrantyUntil < asset.purchaseDate
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["warrantyUntil"],
          message: "Warranty end must be on or after the purchase date.",
        });
      }
    });
}

export type AssetFormValues = z.infer<ReturnType<typeof assetFormSchema>>;

/** Column values for an insert/update from validated form values. */
export function toAssetColumns(asset: AssetFormValues) {
  return {
    name: asset.name,
    category: asset.category,
    serial_number: asset.serialNumber,
    department: asset.department,
    registered_building_id: asset.buildingId,
    registered_room_id: asset.roomId,
    purchase_date: asset.purchaseDate,
    warranty_until: asset.warrantyUntil,
    description: asset.description,
  };
}

// --- List filters (URL search params) --------------------------------------------

/** Orders the asset list can be sorted in besides newest first (docs/06 §27). */
export const ASSET_SORTS = {
  name: "Name (A–Z)",
  asset_id: "Asset ID",
  updated: "Recently updated",
  warranty: "Warranty ending first",
} as const;

export type AssetSort = keyof typeof ASSET_SORTS;

export type AssetListParams = {
  search: string | null;
  status: AssetStatus | null;
  category: AssetCategory | null;
  buildingId: string | null;
  department: string | null;
  sort: AssetSort | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * Search text is embedded in a PostgREST filter, so keep only characters
 * that appear in asset IDs, names and serials (letters, digits, space and
 * - _ . / #). Everything else is dropped; the value is also quoted.
 */
export function normalizeSearch(raw: string): string | null {
  const cleaned = raw
    .replace(/[^\p{L}\p{N} ._/#-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();
  return cleaned || null;
}

const MAX_PAGE = 10_000;

/** Parses list filters from the URL; invalid values are ignored. */
export function parseAssetListParams(params: SearchParams): AssetListParams {
  const status = first(params.status);
  const category = first(params.category);
  const buildingId = first(params.building);
  const department = first(params.department).slice(0, 100);
  const sort = first(params.sort);
  const page = Number.parseInt(first(params.page), 10);

  return {
    search: normalizeSearch(first(params.search)),
    status:
      Constants.public.Enums.asset_status.find((s) => s === status) ?? null,
    category: ASSET_CATEGORIES.find((c) => c === category) ?? null,
    buildingId: z.uuid().safeParse(buildingId).success ? buildingId : null,
    department: department || null,
    sort: Object.hasOwn(ASSET_SORTS, sort) ? (sort as AssetSort) : null,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

/** The query string for a list URL, omitting empty filters and page 1. */
export function assetListQuery(params: AssetListParams): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.category) query.set("category", params.category);
  if (params.buildingId) query.set("building", params.buildingId);
  if (params.department) query.set("department", params.department);
  if (params.sort) query.set("sort", params.sort);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

/** True when the list is narrowed down (sorting alone does not count). */
export function hasActiveFilters(params: AssetListParams): boolean {
  return Boolean(
    params.search ||
    params.status ||
    params.category ||
    params.buildingId ||
    params.department,
  );
}

/** Asset IDs in URLs, e.g. AST-2026-00142. */
export const assetIdParam = z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/);
