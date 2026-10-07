import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const DOCUMENT = "33333333-4444-4555-8666-777777777777";

const maybeSingle = vi.fn();
const createSignedUrl = vi.fn();
const storageFrom = vi.fn(() => ({ createSignedUrl }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    storage: { from: storageFrom },
  }),
}));
vi.mock("@/lib/env", () => ({ getSupabaseConfig: () => ({ ok: true }) }));

const { GET } = await import("@/app/api/files/[documentId]/route");

function open(documentId: string, query = "") {
  return GET(
    new NextRequest(`http://localhost:3000/api/files/${documentId}${query}`),
    { params: Promise.resolve({ documentId }) },
  );
}

const document = {
  bucket_name: "maintenance-documents",
  storage_path: `maintenance/request/${DOCUMENT}.pdf`,
  original_filename: "service report.pdf",
};

describe("GET /api/files/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: document, error: null });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.test/object/sign/x?token=abc" },
      error: null,
    });
  });

  it("redirects_to_a_one_minute_signed_url_that_is_never_cached", async () => {
    const response = await open(DOCUMENT);

    expect(storageFrom).toHaveBeenCalledWith("maintenance-documents");
    expect(createSignedUrl).toHaveBeenCalledWith(document.storage_path, 60, {
      download: false,
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://storage.test/object/sign/x?token=abc",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("downloads_under_the_original_name_when_asked", async () => {
    await open(DOCUMENT, "?download=1");
    expect(createSignedUrl).toHaveBeenCalledWith(document.storage_path, 60, {
      download: "service report.pdf",
    });
  });

  it("answers_404_for_a_file_the_user_cannot_see", async () => {
    // RLS hides the row: unknown id, no access and signed-out look the same.
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await open(DOCUMENT);
    expect(response.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("answers_404_when_the_object_is_missing_from_storage", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Object not found" },
    });
    const response = await open(DOCUMENT);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("File unavailable.");
  });

  it("rejects_malformed_ids_without_querying", async () => {
    const response = await open("../../etc/passwd");
    expect(response.status).toBe(404);
    expect(maybeSingle).not.toHaveBeenCalled();
  });
});
