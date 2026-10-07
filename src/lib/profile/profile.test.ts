import { beforeEach, describe, expect, it, vi } from "vitest";

import { profileSchema } from "./schema";

// --- Schema ------------------------------------------------------------------

describe("profileSchema", () => {
  it("trims_values_and_turns_empty_optional_fields_into_null", () => {
    expect(
      profileSchema.parse({
        fullName: "  Asha  ",
        department: "  ",
        phone: "",
      }),
    ).toEqual({ fullName: "Asha", department: null, phone: null });
  });

  it.each([
    [
      { fullName: "", department: "", phone: "" },
      "fullName",
      "Enter your full name.",
    ],
    [
      { fullName: "A", department: "x".repeat(101), phone: "" },
      "department",
      "Department must be 100 characters or fewer.",
    ],
    [
      { fullName: "A", department: "", phone: "call me" },
      "phone",
      "Use digits, spaces and + ( ) - only.",
    ],
  ])("rejects_%o", (input, field, message) => {
    const result = profileSchema.safeParse(input);
    expect(result.error?.issues.find((i) => i.path[0] === field)?.message).toBe(
      message,
    );
  });

  it("accepts_international_phone_formats", () => {
    expect(
      profileSchema.parse({
        fullName: "A",
        department: "",
        phone: "+91 (22) 1234-5678",
      }).phone,
    ).toBe("+91 (22) 1234-5678");
  });
});

// --- Action ------------------------------------------------------------------

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: () => requireUser(),
}));

const update = vi.fn();
const eq = vi.fn();
let updateResult: { data: unknown; error: unknown };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return {
          eq: (column: string, value: string) => {
            eq(column, value);
            return { select: () => ({ single: async () => updateResult }) };
          },
        };
      },
    }),
  }),
}));

const { updateProfile } = await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "user-1", role: "STUDENT" });
    updateResult = { data: { id: "user-1" }, error: null };
  });

  it("updates_only_contact_fields_of_the_signed_in_user", async () => {
    const state = await updateProfile(
      { status: "idle" },
      form({
        fullName: "Asha K",
        department: "CSE",
        phone: "",
        role: "ADMIN",
        id: "someone-else",
      }),
    );

    expect(state.status).toBe("success");
    expect(update).toHaveBeenCalledWith({
      full_name: "Asha K",
      department: "CSE",
      phone: null,
    });
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("returns_field_errors_without_writing", async () => {
    const state = await updateProfile(
      { status: "idle" },
      form({ fullName: " ", department: "", phone: "" }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.fullName).toEqual(["Enter your full name."]);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns_a_friendly_error_when_the_database_rejects_the_update", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    updateResult = {
      data: null,
      error: { code: "PGRST116", message: "0 rows" },
    };
    const state = await updateProfile(
      { status: "idle" },
      form({ fullName: "Asha", department: "", phone: "" }),
    );
    expect(state).toMatchObject({
      status: "error",
      message: "Unable to save your profile. Please try again.",
    });
  });

  it("requires_a_signed_in_user", async () => {
    requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(
      updateProfile(
        { status: "idle" },
        form({ fullName: "Asha", department: "", phone: "" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(update).not.toHaveBeenCalled();
  });
});
