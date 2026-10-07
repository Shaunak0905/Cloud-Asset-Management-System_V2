import { beforeEach, describe, expect, it, vi } from "vitest";

import { flashMessage, withFlash } from "@/lib/flash";

import { buildingSchema, buildingUpdateSchema, roomSchema } from "./schema";

// --- Validation ----------------------------------------------------------------

describe("buildingSchema", () => {
  it("normalises_the_code_to_upper_case_and_empty_description_to_null", () => {
    expect(
      buildingSchema.parse({ name: " Vyas ", code: " vy ", description: "" }),
    ).toEqual({
      name: "Vyas",
      code: "VY",
      description: null,
    });
  });

  it.each([
    [{ name: "", code: "VY", description: "" }, "name"],
    [{ name: "Vyas", code: "V Y", description: "" }, "code"],
    [{ name: "Vyas", code: "TOOLONGCODE", description: "" }, "code"],
    [{ name: "Vyas", code: "VY", description: "x".repeat(501) }, "description"],
  ])("rejects_%o", (input, field) => {
    const result = buildingSchema.safeParse(input);
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field);
  });

  it("reads_the_active_checkbox", () => {
    const base = { name: "Vyas", code: "VY", description: "" };
    expect(
      buildingUpdateSchema.parse({ ...base, isActive: "on" }).isActive,
    ).toBe(true);
    expect(
      buildingUpdateSchema.parse({ ...base, isActive: null }).isActive,
    ).toBe(false);
  });
});

describe("roomSchema", () => {
  it.each(["VY001", "Lab 2", "VK-404", "a_1"])("accepts_%s", (roomNumber) => {
    expect(roomSchema.safeParse({ roomNumber, displayName: "" }).success).toBe(
      true,
    );
  });

  it.each(["", " ", "-VY", "x".repeat(21), "VY/001"])(
    "rejects_%s",
    (roomNumber) => {
      expect(
        roomSchema.safeParse({ roomNumber, displayName: "" }).success,
      ).toBe(false);
    },
  );
});

describe("flash messages", () => {
  it("builds_redirect_urls_and_only_accepts_known_codes", () => {
    expect(withFlash("/admin/buildings/1", "building-created")).toBe(
      "/admin/buildings/1?toast=building-created",
    );
    expect(flashMessage("building-created")).toBe("Building created.");
    expect(flashMessage("<script>")).toBeNull();
    expect(flashMessage("toString")).toBeNull();
    expect(flashMessage(null)).toBeNull();
  });
});

// --- Server Actions ------------------------------------------------------------

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

type Result = { data: unknown; error: unknown };
let result: Result;
const calls: Array<{
  table: string;
  op: string;
  payload?: unknown;
  filters: unknown[];
}> = [];

/** Minimal chainable stand-in for the Supabase query builder. */
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      const call = {
        table,
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

const { createBuilding, createRoom, updateBuilding, updateRoom } =
  await import("./actions");

const BUILDING_ID = "6f1c7a8e-2b1d-4c1e-9a3f-1d2e3f4a5b6c";
const ROOM_ID = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const idle = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
  result = { data: { id: BUILDING_ID }, error: null };
});

describe("location actions", () => {
  it("require_the_admin_role_before_touching_the_database", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      createBuilding(idle, form({ name: "X", code: "X", description: "" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    await expect(
      createRoom(
        BUILDING_ID,
        idle,
        form({ roomNumber: "X1", displayName: "" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(calls).toHaveLength(0);
  });

  it("createBuilding_inserts_normalised_values_and_redirects_with_a_flash", async () => {
    await expect(
      createBuilding(
        idle,
        form({ name: "Tagore", code: "tg", description: "" }),
      ),
    ).rejects.toMatchObject({
      path: `/admin/buildings/${BUILDING_ID}?toast=building-created`,
    });
    expect(calls[0]).toMatchObject({
      table: "buildings",
      op: "insert",
      payload: { name: "Tagore", code: "TG", description: null },
    });
  });

  it("createBuilding_returns_field_errors_and_keeps_the_values", async () => {
    const state = await createBuilding(
      idle,
      form({ name: "", code: "bad code", description: "" }),
    );
    expect(state.status).toBe("error");
    expect(Object.keys(state.fieldErrors ?? {})).toEqual(
      expect.arrayContaining(["name", "code"]),
    );
    expect(state.values).toMatchObject({ code: "bad code" });
    expect(calls).toHaveLength(0);
  });

  it("maps_a_duplicate_building_code_to_the_code_field", async () => {
    result = {
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "buildings_code_key"',
      },
    };
    const state = await createBuilding(
      idle,
      form({ name: "Vyas 2", code: "VY", description: "" }),
    );
    expect(state.fieldErrors).toEqual({
      code: ["Another building already uses this code."],
    });
  });

  it("updateBuilding_saves_the_active_flag_and_scopes_to_the_building", async () => {
    const state = await updateBuilding(
      BUILDING_ID,
      idle,
      form({ name: "Vyas", code: "VY", description: "" }), // checkbox unticked
    );
    expect(state.status).toBe("success");
    expect(calls[0]).toMatchObject({
      table: "buildings",
      op: "update",
      payload: {
        name: "Vyas",
        code: "VY",
        description: null,
        is_active: false,
      },
      filters: [["id", BUILDING_ID]],
    });
  });

  it("rejects_malformed_ids_without_querying", async () => {
    const state = await updateBuilding(
      "not-a-uuid",
      idle,
      form({ name: "V", code: "V" }),
    );
    expect(state).toEqual({
      status: "error",
      message: "This building no longer exists.",
    });
    expect(calls).toHaveLength(0);
  });

  it("createRoom_adds_a_room_to_the_given_building_and_clears_the_form", async () => {
    const state = await createRoom(
      BUILDING_ID,
      idle,
      form({ roomNumber: "VY301", displayName: "Lab" }),
    );
    expect(state.status).toBe("success");
    expect(state.values).toBeUndefined();
    expect(calls[0]).toMatchObject({
      table: "rooms",
      op: "insert",
      payload: {
        building_id: BUILDING_ID,
        room_number: "VY301",
        display_name: "Lab",
      },
    });
  });

  it("maps_a_duplicate_room_number_to_the_room_number_field", async () => {
    result = {
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "rooms_building_room_number_key"',
      },
    };
    const state = await createRoom(
      BUILDING_ID,
      idle,
      form({ roomNumber: "VY001", displayName: "" }),
    );
    expect(state.fieldErrors).toEqual({
      roomNumber: ["This building already has a room with this number."],
    });
  });

  it("updateRoom_matches_both_room_and_building", async () => {
    await updateRoom(
      ROOM_ID,
      BUILDING_ID,
      idle,
      form({ roomNumber: "VY001", displayName: "", isActive: "on" }),
    );
    expect(calls[0]).toMatchObject({
      table: "rooms",
      payload: { room_number: "VY001", display_name: null, is_active: true },
      filters: [
        ["id", ROOM_ID],
        ["building_id", BUILDING_ID],
      ],
    });
  });

  it("returns_a_safe_message_for_unexpected_database_errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    result = {
      data: null,
      error: { code: "XX000", message: "internal: relation broke" },
    };
    const state = await createRoom(
      BUILDING_ID,
      idle,
      form({ roomNumber: "VY9", displayName: "" }),
    );
    expect(state.message).toBe("Unable to save the room. Please try again.");
    expect(JSON.stringify(state)).not.toContain("relation broke");
  });
});
