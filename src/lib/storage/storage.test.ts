import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EVIDENCE_TYPES,
  fileHref,
  fileProblem,
  isStoragePathFor,
  MAX_FILE_BYTES,
  newStoragePath,
  safeDisplayName,
  sniffMimeType,
  UPLOAD_KINDS,
} from "./files";
import { downscaleImage } from "./image";

const ASSET = "11111111-2222-4333-8444-555555555555";
const REQUEST = "22222222-3333-4444-8555-666666666666";
const DOCUMENT = "33333333-4444-4555-8666-777777777777";

const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1,
]);
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
]);
const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBP");
const PDF = new TextEncoder().encode("%PDF-1.7\n%\u00e2\u00e3");
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]);

function fileOf(bytes: Uint8Array, name: string, type: string) {
  return new File([bytes as BlobPart], name, { type });
}

describe("file rules", () => {
  it("accepts_only_the_types_of_each_document_kind", () => {
    const ok = { type: "image/png", size: 1000 };
    expect(fileProblem(ok, "ASSET_IMAGE")).toBeNull();
    expect(fileProblem(ok, "MAINTENANCE_IMAGE")).toBeNull();
    expect(fileProblem(ok, "SERVICE_REPORT")).toBe("Choose a PDF file.");
    expect(
      fileProblem({ type: "application/pdf", size: 1000 }, "ASSET_IMAGE"),
    ).toBe("Choose a JPG, PNG or WebP file.");
    expect(
      fileProblem({ type: "application/x-msdownload", size: 1 }, "OTHER"),
    ).toBe("Choose a PDF file.");
  });

  it("enforces_the_10_mb_limit", () => {
    expect(
      fileProblem({ type: "image/jpeg", size: MAX_FILE_BYTES }, "ASSET_IMAGE"),
    ).toBeNull();
    expect(
      fileProblem(
        { type: "image/jpeg", size: MAX_FILE_BYTES + 1 },
        "ASSET_IMAGE",
      ),
    ).toBe("This file is larger than 10 MB.");
    expect(fileProblem({ type: "image/jpeg", size: 0 }, "ASSET_IMAGE")).toBe(
      "This file is empty.",
    );
  });

  it("recognises_files_by_their_first_bytes_not_their_name", () => {
    expect(sniffMimeType(JPEG)).toBe("image/jpeg");
    expect(sniffMimeType(PNG)).toBe("image/png");
    expect(sniffMimeType(WEBP)).toBe("image/webp");
    expect(sniffMimeType(PDF)).toBe("application/pdf");
    expect(sniffMimeType(EXE)).toBeNull();
    expect(sniffMimeType(new Uint8Array())).toBeNull();
  });

  it("keeps_evidence_in_the_maintenance_buckets", () => {
    for (const type of EVIDENCE_TYPES) {
      expect(UPLOAD_KINDS[type].folder).toBe("maintenance");
      expect(UPLOAD_KINDS[type].bucket).toMatch(/^maintenance-/);
    }
    expect(UPLOAD_KINDS.ASSET_IMAGE.bucket).toBe("asset-images");
  });
});

describe("storage paths", () => {
  it("are_generated_per_entity_and_never_use_the_file_name", () => {
    const path = newStoragePath("ASSET_IMAGE", ASSET, "image/webp");
    expect(path).toMatch(new RegExp(`^assets/${ASSET}/[0-9a-f-]{36}\\.webp$`));
    expect(newStoragePath("RECEIPT", REQUEST, "application/pdf")).toMatch(
      new RegExp(`^maintenance/${REQUEST}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(newStoragePath("ASSET_IMAGE", ASSET, "image/webp")).not.toBe(path);
  });

  it("are_accepted_only_for_their_own_entity_kind_and_type", () => {
    const path = newStoragePath("MAINTENANCE_IMAGE", REQUEST, "image/jpeg");
    const check = (...args: Parameters<typeof isStoragePathFor>) =>
      isStoragePathFor(...args);

    expect(check(path, "MAINTENANCE_IMAGE", REQUEST, "image/jpeg")).toBe(true);
    expect(check(path, "MAINTENANCE_IMAGE", ASSET, "image/jpeg")).toBe(false);
    expect(check(path, "ASSET_IMAGE", REQUEST, "image/jpeg")).toBe(false);
    expect(check(path, "MAINTENANCE_IMAGE", REQUEST, "image/png")).toBe(false);
    for (const crafted of [
      `maintenance/${REQUEST}/../${REQUEST}/x.jpg`,
      `maintenance/${REQUEST}/photo.jpg`,
      `/maintenance/${REQUEST}/${DOCUMENT}.jpg`,
      `maintenance/${REQUEST}/${DOCUMENT}.jpg.exe`,
    ]) {
      expect(check(crafted, "MAINTENANCE_IMAGE", REQUEST, "image/jpeg")).toBe(
        false,
      );
    }
  });

  it("strip_directories_and_control_characters_from_display_names", () => {
    expect(safeDisplayName("C:\\Users\\me\\photo.jpg")).toBe("photo.jpg");
    expect(safeDisplayName("../../etc/passwd")).toBe("passwd");
    expect(safeDisplayName("re\u0000port\n.pdf")).toBe("report.pdf");
    expect(safeDisplayName("   ")).toBe("file");
    expect(safeDisplayName("x".repeat(400))).toHaveLength(255);
  });

  it("link_to_files_by_document_id", () => {
    expect(fileHref(DOCUMENT)).toBe(`/api/files/${DOCUMENT}`);
    expect(fileHref(DOCUMENT, true)).toBe(`/api/files/${DOCUMENT}?download=1`);
  });
});

describe("downscaleImage", () => {
  it("leaves_small_images_and_documents_unchanged", async () => {
    const photo = fileOf(JPEG, "photo.jpg", "image/jpeg");
    expect(await downscaleImage(photo)).toBe(photo);
    const report = fileOf(PDF, "report.pdf", "application/pdf");
    expect(await downscaleImage(report)).toBe(report);
  });

  it("falls_back_to_the_original_when_the_browser_cannot_process_it", async () => {
    // No createImageBitmap here (Node), as in an old browser.
    const big = new File([new Uint8Array(2 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    expect(await downscaleImage(big)).toBe(big);
  });
});

// --- Browser upload ---------------------------------------------------------------

const storageUpload = vi.fn();
const storageFrom = vi.fn(() => ({ upload: storageUpload }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: storageFrom } }),
}));

const { uploadFile } = await import("./upload");

describe("uploadFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageUpload.mockResolvedValue({ data: {}, error: null });
  });

  it("uploads_to_the_kinds_bucket_under_a_generated_path", async () => {
    const result = await uploadFile(
      fileOf(PDF, "Invoice March.pdf", "application/pdf"),
      "RECEIPT",
      REQUEST,
    );

    expect(storageFrom).toHaveBeenCalledWith("maintenance-documents");
    const [path, , options] = storageUpload.mock.calls[0];
    expect(path).toMatch(
      new RegExp(`^maintenance/${REQUEST}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(options).toEqual({ contentType: "application/pdf", upsert: false });
    expect(result).toEqual({
      ok: true,
      file: {
        path,
        originalFilename: "Invoice March.pdf",
        mimeType: "application/pdf",
        size: PDF.byteLength,
      },
    });
  });

  it("refuses_a_wrong_type_before_uploading", async () => {
    const result = await uploadFile(
      fileOf(PDF, "report.pdf", "application/pdf"),
      "MAINTENANCE_IMAGE",
      REQUEST,
    );
    expect(result).toEqual({
      ok: false,
      message: "Choose a JPG, PNG or WebP file.",
    });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("refuses_a_renamed_file_whose_content_is_not_what_it_claims", async () => {
    const result = await uploadFile(
      fileOf(EXE, "photo.jpg", "image/jpeg"),
      "ASSET_IMAGE",
      ASSET,
    );
    expect(result).toEqual({
      ok: false,
      message: "This file is not a valid JPG, PNG or WebP file.",
    });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("hides_raw_storage_errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    storageUpload.mockResolvedValue({
      data: null,
      error: { message: "new row violates row-level security policy" },
    });
    const result = await uploadFile(
      fileOf(JPEG, "photo.jpg", "image/jpeg"),
      "ASSET_IMAGE",
      ASSET,
    );
    expect(result).toEqual({
      ok: false,
      message: "Upload failed. Please try again.",
    });
  });
});

// --- Server actions -----------------------------------------------------------------

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireUser = vi.fn();
const requireRole = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({
  requireUser: () => requireUser(),
  requireRole: (roles: string[]) => requireRole(roles),
}));

/** A chainable stand-in for a PostgREST query that resolves to `result`. */
function query(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "delete", "eq", "neq"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(async () => result);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return builder as Record<string, ReturnType<typeof vi.fn>>;
}

const createSignedUrl = vi.fn();
const remove = vi.fn();
const serverFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: serverFrom,
    storage: { from: () => ({ createSignedUrl, remove }) },
  }),
}));

const { deleteDocument, registerAssetImage, registerEvidence } =
  await import("./actions");

function storedContent(bytes: Uint8Array) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(bytes as BodyInit, { status: 206 })),
  );
}

const evidencePath = `maintenance/${REQUEST}/${DOCUMENT}.jpg`;
const evidence = {
  path: evidencePath,
  originalFilename: "after repair.jpg",
  mimeType: "image/jpeg",
  size: 2048,
};

describe("registerEvidence", () => {
  let insert: ReturnType<typeof query>;

  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ id: "tech-1", role: "TECHNICIAN" });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.test/signed" },
      error: null,
    });
    remove.mockResolvedValue({ error: null });
    insert = query({ data: { id: DOCUMENT }, error: null });
    serverFrom.mockReturnValue(insert);
    storedContent(JPEG);
  });

  const register = (upload: unknown, type = "MAINTENANCE_IMAGE") =>
    registerEvidence(REQUEST, "MR-2026-0017", type as never, upload);

  it("checks_the_stored_content_then_records_the_file", async () => {
    const state = await register({ ...evidence, uploadedBy: "someone-else" });

    expect(state.status).toBe("success");
    expect(insert.insert).toHaveBeenCalledWith({
      maintenance_request_id: REQUEST,
      bucket_name: "maintenance-images",
      storage_path: evidencePath,
      original_filename: "after repair.jpg",
      mime_type: "image/jpeg",
      file_size_bytes: 2048,
      document_type: "MAINTENANCE_IMAGE",
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a path of another request",
      { path: `maintenance/${ASSET}/${DOCUMENT}.jpg` },
    ],
    ["a path outside the request", { path: "maintenance/../secret.jpg" }],
    [
      "an extension that does not match the type",
      { path: `maintenance/${REQUEST}/${DOCUMENT}.pdf` },
    ],
    ["a type the kind does not take", { mimeType: "application/pdf" }],
    ["an unknown type", { mimeType: "application/x-msdownload" }],
    ["an oversized file", { size: MAX_FILE_BYTES + 1 }],
  ])("rejects_%s_without_touching_storage", async (_label, override) => {
    const state = await register({ ...evidence, ...override });
    expect(state).toMatchObject({ status: "error" });
    expect(serverFrom).not.toHaveBeenCalled();
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("does_not_wait_for_the_download_to_be_cancelled", async () => {
    // Inside Next.js, cancel() on a fetched body never settles (the framework
    // holds a second copy). Awaiting it once hung every upload on "Saving…".
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({ value: JPEG, done: false }),
            cancel: () => new Promise(() => {}),
          }),
        },
      })),
    );
    const state = await register(evidence);
    expect(state.status).toBe("success");
  });

  it("limits_how_long_the_content_check_may_take", async () => {
    await register(evidence);
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.headers).toEqual({ Range: "bytes=0-11" });
  });

  it("fails_cleanly_when_the_stored_file_cannot_be_read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }),
    );
    const state = await register(evidence);
    // Not blamed on the file: we simply could not check it.
    expect(state.message).toBe("Upload failed. Please try again.");
    expect(remove).toHaveBeenCalledWith([evidencePath]);
    expect(serverFrom).not.toHaveBeenCalled();
  });

  it("removes_a_file_whose_content_is_not_what_it_claims", async () => {
    storedContent(EXE);
    const state = await register(evidence);
    expect(state.message).toBe(
      "This file is not a valid JPG, PNG or WebP file.",
    );
    expect(remove).toHaveBeenCalledWith([evidencePath]);
    expect(serverFrom).not.toHaveBeenCalled();
  });

  it("cleans_up_the_upload_when_the_database_refuses_it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    serverFrom.mockReturnValue(
      query({ data: null, error: { code: "42501", message: "rls" } }),
    );
    const state = await register(evidence);
    expect(state.message).toContain("not allowed to add files");
    expect(remove).toHaveBeenCalledWith([evidencePath]);
  });

  it("only_accepts_evidence_types", async () => {
    const state = await register(evidence, "ASSET_IMAGE");
    expect(state.status).toBe("error");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });
});

describe("registerAssetImage", () => {
  const photoPath = `assets/${ASSET}/${DOCUMENT}.png`;
  const photo = {
    path: photoPath,
    originalFilename: "front.png",
    mimeType: "image/png",
    size: 4096,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.test/signed" },
      error: null,
    });
    remove.mockResolvedValue({ error: null });
    storedContent(PNG);
  });

  it("is_admin_only_and_replaces_the_previous_photo_after_the_new_one_is_saved", async () => {
    const old = {
      id: "old-doc",
      bucket_name: "asset-images",
      storage_path: "assets/x/old.jpg",
    };
    const insert = query({ data: { id: DOCUMENT }, error: null });
    const previous = query({ data: [old], error: null });
    const deletion = query({ error: null, count: 1 });
    serverFrom
      .mockReturnValueOnce(insert)
      .mockReturnValueOnce(previous)
      .mockReturnValueOnce(deletion);

    const state = await registerAssetImage(
      ASSET,
      "AST-2026-00001",
      "ASSET_IMAGE",
      photo,
    );

    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(state.status).toBe("success");
    expect(insert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: ASSET,
        document_type: "ASSET_IMAGE",
      }),
    );
    expect(previous.neq).toHaveBeenCalledWith("id", DOCUMENT);
    expect(deletion.eq).toHaveBeenCalledWith("id", "old-doc");
    expect(remove).toHaveBeenCalledWith(["assets/x/old.jpg"]);
  });

  it("keeps_the_current_photo_when_the_new_one_is_refused", async () => {
    storedContent(EXE);
    const state = await registerAssetImage(
      ASSET,
      "AST-2026-00001",
      "ASSET_IMAGE",
      photo,
    );
    expect(state.status).toBe("error");
    // Only the rejected upload is removed.
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([photoPath]);
    expect(serverFrom).not.toHaveBeenCalled();
  });
});

describe("deleteDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRole.mockResolvedValue({ id: "admin-1", role: "ADMIN" });
    remove.mockResolvedValue({ error: null });
  });

  it("deletes_the_metadata_then_the_object", async () => {
    const lookup = query({
      data: {
        id: DOCUMENT,
        bucket_name: "maintenance-images",
        storage_path: evidencePath,
      },
      error: null,
    });
    const deletion = query({ error: null, count: 1 });
    serverFrom.mockReturnValueOnce(lookup).mockReturnValueOnce(deletion);

    const state = await deleteDocument(
      DOCUMENT,
      "AST-2026-00001",
      "MR-2026-0017",
    );

    expect(requireRole).toHaveBeenCalledWith(["ADMIN"]);
    expect(state.status).toBe("success");
    expect(deletion.delete).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([evidencePath]);
  });

  it("leaves_the_object_alone_when_the_metadata_was_not_deleted", async () => {
    const lookup = query({
      data: {
        id: DOCUMENT,
        bucket_name: "maintenance-images",
        storage_path: evidencePath,
      },
      error: null,
    });
    serverFrom
      .mockReturnValueOnce(lookup)
      .mockReturnValueOnce(query({ error: null, count: 0 }));
    const state = await deleteDocument(DOCUMENT, "AST-2026-00001", null);
    expect(state.status).toBe("error");
    expect(remove).not.toHaveBeenCalled();
  });

  it("says_when_the_file_is_already_gone", async () => {
    serverFrom.mockReturnValueOnce(query({ data: null, error: null }));
    const state = await deleteDocument(DOCUMENT, "AST-2026-00001", null);
    expect(state.message).toBe("This file no longer exists.");
  });
});
