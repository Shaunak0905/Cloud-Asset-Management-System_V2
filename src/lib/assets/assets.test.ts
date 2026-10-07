import { beforeEach, describe, expect, it, vi } from "vitest";

import { campusToday, formatDate, warrantyState } from "@/lib/format";
import { isIsoDate } from "@/lib/forms";

import {
  assetFormSchema,
  assetListQuery,
  normalizeSearch,
  parseAssetListParams,
} from "./schema";
import { canChangeStatusManually, manualStatusTargets } from "./status";

const BUILDING = "6f1c7a8e-2b1d-4c1e-9a3f-1d2e3f4a5b6c";
const ROOM = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const TODAY = "2026-09-29";

const validForm = {
  name: "Epson Projector P-104",
  category: "Projector",
  serialNumber: "",
  department: " Computer Science ",
  buildingId: BUILDING,
  roomId: ROOM,
  purchaseDate: "2025-01-15",
  warrantyUntil: "2028-01-15",
  description: "",
};

function issues(input: Record<string, string>) {
  const result = assetFormSchema(TODAY).safeParse(input);
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]),
  );
}

// --- Form validation -------------------------------------------------------------

describe("assetFormSchema", () => {
  it("accepts_a_complete_asset_and_normalises_empty_fields", () => {
    expect(assetFormSchema(TODAY).parse(validForm)).toEqual({
      ...validForm,
      serialNumber: null,
      department: "Computer Science",
      description: null,
    });
  });

  it("requires_name_category_building_and_room", () => {
    expect(
      issues({
        ...validForm,
        name: " ",
        category: "",
        buildingId: "",
        roomId: "",
      }),
    ).toEqual({
      name: "Enter the asset name.",
      category: "Choose a category.",
      buildingId: "Select a building.",
      roomId: "Select a room.",
    });
  });

  it("rejects_unknown_categories_and_malformed_ids", () => {
    expect(
      issues({ ...validForm, category: "Toaster", roomId: "VY001" }),
    ).toEqual({
      category: "Choose a category.",
      roomId: "Select a room.",
    });
  });

  it("rejects_future_purchase_dates_and_impossible_dates", () => {
    expect(issues({ ...validForm, purchaseDate: "2026-09-30" })).toEqual({
      purchaseDate: "Purchase date cannot be in the future.",
    });
    expect(issues({ ...validForm, purchaseDate: "2025-02-30" })).toEqual({
      purchaseDate: "Enter a valid date.",
    });
  });

  it("rejects_warranty_ending_before_purchase", () => {
    expect(issues({ ...validForm, warrantyUntil: "2024-12-31" })).toEqual({
      warrantyUntil: "Warranty end must be on or after the purchase date.",
    });
  });

  it("allows_missing_dates", () => {
    expect(
      issues({ ...validForm, purchaseDate: "", warrantyUntil: "" }),
    ).toEqual({});
  });
});

describe("isIsoDate", () => {
  it.each(["2026-02-28", "2024-02-29"])("accepts_%s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });
  it.each(["2026-02-29", "2026-13-01", "26-01-01", "2026-1-1", ""])(
    "rejects_%s",
    (value) => {
      expect(isIsoDate(value)).toBe(false);
    },
  );
});

// --- List filters ------------------------------------------------------------------

describe("parseAssetListParams", () => {
  it("reads_valid_filters_from_the_url", () => {
    expect(
      parseAssetListParams({
        search: " projector ",
        status: "AVAILABLE",
        category: "Projector",
        building: BUILDING,
        department: "Computer Science",
        sort: "warranty",
        page: "3",
      }),
    ).toEqual({
      search: "projector",
      status: "AVAILABLE",
      category: "Projector",
      buildingId: BUILDING,
      department: "Computer Science",
      sort: "warranty",
      page: 3,
    });
  });

  it("ignores_invalid_values_instead_of_failing", () => {
    expect(
      parseAssetListParams({
        status: "HACKED",
        category: "Toaster",
        building: "1 or 1=1",
        sort: "created_at; drop table",
        page: "-2",
      }),
    ).toEqual({
      search: null,
      status: null,
      category: null,
      buildingId: null,
      department: null,
      sort: null,
      page: 1,
    });
    expect(parseAssetListParams({ page: "abc" }).page).toBe(1);
    expect(parseAssetListParams({ page: "999999" }).page).toBe(1);
    expect(parseAssetListParams({ status: ["LOST", "AVAILABLE"] }).status).toBe(
      "LOST",
    );
  });
});

describe("normalizeSearch", () => {
  it("keeps_characters_found_in_ids_names_and_serials", () => {
    expect(normalizeSearch("AST-2026-00142")).toBe("AST-2026-00142");
    expect(normalizeSearch("EP-ABC-12345")).toBe("EP-ABC-12345");
    expect(normalizeSearch("Raspberry Pi 5")).toBe("Raspberry Pi 5");
  });

  it("strips_characters_that_could_alter_the_postgrest_filter", () => {
    const hostile = 'x",status.eq.RETIRED),or(name.ilike.*';
    const cleaned = normalizeSearch(hostile)!;
    for (const character of [",", '"', "(", ")", "*", ":"]) {
      expect(cleaned).not.toContain(character);
    }
  });

  it("returns_null_for_blank_input_and_caps_length", () => {
    expect(normalizeSearch("   ")).toBeNull();
    expect(normalizeSearch("%%%")).toBeNull();
    expect(normalizeSearch("a".repeat(500))).toHaveLength(100);
  });
});

describe("assetListQuery", () => {
  it("omits_empty_filters_and_the_first_page", () => {
    const base = parseAssetListParams({});
    expect(assetListQuery(base)).toBe("");
    expect(assetListQuery({ ...base, status: "LOST", page: 2 })).toBe(
      "?status=LOST&page=2",
    );
  });
});

// --- Status & formatting -----------------------------------------------------------

describe("manual status changes", () => {
  it("never_offers_assigned_or_changes_to_retired_assets", () => {
    expect(manualStatusTargets("AVAILABLE")).not.toContain("ASSIGNED");
    expect(manualStatusTargets("ASSIGNED")).toEqual([]);
    expect(manualStatusTargets("RETIRED")).toEqual([]);
    expect(canChangeStatusManually("LOST", "AVAILABLE")).toBe(true);
    expect(canChangeStatusManually("LOST", "DAMAGED")).toBe(false);
  });
});

describe("date formatting", () => {
  it("formats_plain_dates_without_time_zone_shifts", () => {
    expect(formatDate("2028-01-15")).toBe("15 Jan 2028");
    expect(formatDate(null)).toBe("—");
  });

  it("uses_the_campus_date", () => {
    // 20:00 UTC on 28 Sep is already 29 Sep in India.
    expect(campusToday(new Date("2026-09-28T20:00:00Z"))).toBe("2026-09-29");
  });

  it("treats_the_warranty_end_date_as_still_covered", () => {
    expect(warrantyState("2026-09-29", TODAY)).toEqual({
      kind: "active",
      until: "2026-09-29",
    });
    expect(warrantyState("2026-09-28", TODAY)).toEqual({
      kind: "expired",
      until: "2026-09-28",
    });
    expect(warrantyState(null, TODAY)).toEqual({ kind: "none" });
  });
});

// --- Server Actions ------------------------------------------------------------------

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { path });
  }),
}));

const requireRole = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  requireRole: (roles: string[]) => requireRole(roles),
}));

let result: { data: unknown; error: unknown };
const calls: Array<{ op: string; payload?: unknown; filters: unknown[] }> = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const call = {
        op: "",
        payload: undefined as unknown,
        filters: [] as unknown[],
      };
      calls.push(call);
      const builder = {
        insert: (payload: unknown) => (
          (call.op = "insert"),
          (call.payload = payload),
          builder
        ),
        update: (payload: unknown) => (
          (call.op = "update"),
          (call.payload = payload),
          builder
        ),
        eq: (column: string, value: unknown) => (
          call.filters.push([column, value]),
          builder
        ),
        select: () => builder,
        single: async () => result,
      };
      return builder;
    },
  }),
}));

const { changeAssetStatus, createAsset, updateAsset } =
  await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const idle = { status: "idle" } as const;
const ASSET_UUID = "11111111-2222-4333-8444-555555555555";

describe("asset actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    result = {
      data: { asset_id: "AST-2026-00010", status: "DAMAGED" },
      error: null,
    };
  });

  it("require_admin_before_any_database_access", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(createAsset(idle, form(validForm))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    await expect(
      changeAssetStatus(ASSET_UUID, idle, form({ status: "LOST" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(calls).toHaveLength(0);
  });

  it("createAsset_inserts_only_form_columns_and_redirects_to_the_new_asset", async () => {
    await expect(
      createAsset(
        idle,
        form({ ...validForm, asset_id: "AST-FAKE", status: "RETIRED" }),
      ),
    ).rejects.toMatchObject({
      path: "/assets/AST-2026-00010?toast=asset-created",
    });

    expect(calls[0].op).toBe("insert");
    expect(Object.keys(calls[0].payload as object).sort()).toEqual(
      [
        "category",
        "department",
        "description",
        "name",
        "purchase_date",
        "registered_building_id",
        "registered_room_id",
        "serial_number",
        "warranty_until",
      ].sort(),
    );
  });

  it("maps_a_room_from_another_building_to_the_room_field", async () => {
    result = {
      data: null,
      error: {
        code: "23503",
        message:
          'insert or update on table "assets" violates foreign key constraint "assets_registered_room_fkey"',
      },
    };
    const state = await createAsset(idle, form(validForm));
    expect(state.fieldErrors).toEqual({
      roomId: ["The selected room does not belong to the selected building."],
    });
    expect(state.values?.buildingId).toBe(BUILDING);
  });

  it("maps_a_duplicate_serial_number_to_its_field", async () => {
    result = {
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "assets_serial_number_key"',
      },
    };
    const state = await createAsset(
      idle,
      form({ ...validForm, serialNumber: "EP-1" }),
    );
    expect(state.fieldErrors).toEqual({
      serialNumber: ["Another asset already has this serial number."],
    });
  });

  it("updateAsset_targets_the_asset_and_rejects_malformed_ids", async () => {
    await expect(
      updateAsset(ASSET_UUID, idle, form(validForm)),
    ).rejects.toMatchObject({
      path: "/assets/AST-2026-00010?toast=asset-updated",
    });
    expect(calls[0]).toMatchObject({
      op: "update",
      filters: [["id", ASSET_UUID]],
    });

    const state = await updateAsset("AST-2026-00010", idle, form(validForm));
    expect(state).toEqual({
      status: "error",
      message: "This asset no longer exists.",
    });
    expect(calls).toHaveLength(1);
  });

  it("changeAssetStatus_refuses_assigned_without_touching_the_database", async () => {
    const state = await changeAssetStatus(
      ASSET_UUID,
      idle,
      form({ status: "ASSIGNED" }),
    );
    expect(state.fieldErrors).toEqual({ status: ["Choose a status."] });
    expect(calls).toHaveLength(0);
  });

  it("changeAssetStatus_reports_success_and_disallowed_transitions", async () => {
    const ok = await changeAssetStatus(
      ASSET_UUID,
      idle,
      form({ status: "DAMAGED" }),
    );
    expect(ok).toMatchObject({
      status: "success",
      values: { status: "DAMAGED" },
    });
    expect(calls[0]).toMatchObject({
      op: "update",
      payload: { status: "DAMAGED" },
    });

    result = {
      data: null,
      error: { code: "23514", message: "Invalid asset status transition" },
    };
    const refused = await changeAssetStatus(
      ASSET_UUID,
      idle,
      form({ status: "AVAILABLE" }),
    );
    expect(refused.message).toBe(
      "This change is not allowed for the asset in its current state.",
    );
  });
});
