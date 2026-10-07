// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";
import { EVIDENCE_TYPES } from "@/lib/storage/files";
import type { UploadResult } from "@/lib/storage/upload";

import { DeleteFileButton } from "./delete-file-button";
import { type EvidenceItem, EvidenceList } from "./evidence-list";
import { FileUploader } from "./file-uploader";
import { StoredImage } from "./stored-image";

const REQUEST = "22222222-3333-4444-8555-666666666666";

const photo = () => new File(["x"], "after.jpg", { type: "image/jpeg" });
const pdf = () => new File(["x"], "report.pdf", { type: "application/pdf" });

describe("FileUploader", () => {
  function renderUploader({
    uploaded = {
      ok: true,
      file: {
        path: `maintenance/${REQUEST}/a.jpg`,
        originalFilename: "after.jpg",
        mimeType: "image/jpeg",
        size: 1,
      },
    } as UploadResult,
    registered = { status: "success", savedAt: 1 } as FormState,
    types = EVIDENCE_TYPES as readonly (typeof EVIDENCE_TYPES)[number][],
  } = {}) {
    const upload = vi.fn(async () => uploaded);
    const register = vi.fn(async () => registered);
    render(
      <ToastProvider>
        <FileUploader
          types={types}
          entityId={REQUEST}
          register={register}
          upload={upload}
          buttonLabel="Upload file"
          successMessage="File added."
        />
      </ToastProvider>,
    );
    return { upload, register };
  }

  const input = () => screen.getByLabelText("File") as HTMLInputElement;
  const submit = () => screen.getByRole("button", { name: "Upload file" });
  const choose = (file: File) =>
    fireEvent.change(input(), { target: { files: [file] } });

  it("says_what_is_accepted_and_follows_the_chosen_kind", () => {
    renderUploader();
    expect(input()).toHaveAccessibleDescription(
      "JPG, PNG or WebP · up to 10 MB",
    );
    expect(input().accept).toBe("image/jpeg,image/png,image/webp");

    fireEvent.change(screen.getByLabelText("What is it?"), {
      target: { value: "SERVICE_REPORT" },
    });
    expect(input()).toHaveAccessibleDescription("PDF · up to 10 MB");
    expect(input().accept).toBe("application/pdf");
  });

  it("uploads_then_registers_the_file_and_confirms", async () => {
    const { upload, register } = renderUploader();
    expect(submit()).toBeDisabled();

    const file = photo();
    choose(file);
    await act(async () => {
      fireEvent.click(submit());
    });

    expect(upload).toHaveBeenCalledWith(file, "MAINTENANCE_IMAGE", REQUEST);
    expect(register).toHaveBeenCalledWith(
      "MAINTENANCE_IMAGE",
      expect.objectContaining({ originalFilename: "after.jpg" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("File added.");
    expect(submit()).toBeDisabled(); // cleared for the next file
  });

  it("refuses_a_file_of_the_wrong_kind_before_uploading", () => {
    const { upload } = renderUploader();
    choose(pdf());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a JPG, PNG or WebP file.",
    );
    expect(submit()).toBeDisabled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("shows_why_an_upload_failed_and_does_not_register_it", async () => {
    const { register } = renderUploader({
      uploaded: { ok: false, message: "This file is larger than 10 MB." },
    });
    choose(photo());
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This file is larger than 10 MB.",
    );
    expect(register).not.toHaveBeenCalled();
  });

  it("shows_why_registering_was_refused", async () => {
    renderUploader({
      registered: {
        status: "error",
        message:
          "You are not allowed to add files here, or the request is closed.",
      },
    });
    choose(photo());
    await act(async () => {
      fireEvent.click(submit());
    });
    expect(screen.getByRole("alert")).toHaveTextContent("request is closed");
  });

  it("has_no_kind_picker_when_there_is_only_one_kind", () => {
    renderUploader({ types: ["MAINTENANCE_IMAGE"] });
    expect(screen.queryByLabelText("What is it?")).toBeNull();
  });
});

describe("StoredImage", () => {
  it("loads_through_the_file_route_and_falls_back_when_unavailable", () => {
    render(<StoredImage documentId="doc-1" alt="Photo of Projector" />);
    const image = screen.getByRole("img", { name: "Photo of Projector" });
    expect(image).toHaveAttribute("src", "/api/files/doc-1");

    fireEvent.error(image);
    expect(
      screen.getByRole("img", { name: "Photo of Projector (unavailable)" }),
    ).toHaveTextContent("Image unavailable");
  });
});

describe("EvidenceList", () => {
  const item = (overrides: Partial<EvidenceItem>): EvidenceItem => ({
    id: "doc-1",
    original_filename: "after.jpg",
    mime_type: "image/jpeg",
    file_size_bytes: 2_200_000,
    document_type: "MAINTENANCE_IMAGE",
    created_at: "2026-10-02T06:00:00Z",
    uploaded_by: "tech-1",
    uploader: { full_name: "Ravi Kumar" },
    ...overrides,
  });

  it("shows_photos_as_thumbnails_and_documents_as_links", () => {
    render(
      <ToastProvider>
        <EvidenceList
          viewerId="tech-1"
          files={[
            item({}),
            item({
              id: "doc-2",
              original_filename: "report.pdf",
              mime_type: "application/pdf",
              file_size_bytes: 340_000,
              document_type: "SERVICE_REPORT",
              uploaded_by: "admin-1",
              uploader: null,
            }),
          ]}
        />
      </ToastProvider>,
    );
    const [first, second] = screen.getAllByRole("listitem");

    expect(within(first).getByRole("img")).toHaveAttribute(
      "src",
      "/api/files/doc-1",
    );
    expect(first).toHaveTextContent("Photo · 2.1 MB");
    expect(first).toHaveTextContent("You ·");

    expect(within(second).queryByRole("img")).toBeNull();
    expect(second).toHaveTextContent("Service report · 332 KB");
    expect(
      within(second).getByRole("link", { name: "report.pdf" }),
    ).toHaveAttribute("href", "/api/files/doc-2");
    expect(
      within(second).getByRole("link", { name: "Download" }),
    ).toHaveAttribute("href", "/api/files/doc-2?download=1");
    // No delete action was given (not an admin).
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("says_when_there_are_no_files", () => {
    render(<EvidenceList viewerId="x" files={[]} />);
    expect(screen.getByText("No files attached yet.")).toBeInTheDocument();
  });
});

describe("DeleteFileButton", () => {
  it("asks_before_deleting", async () => {
    const action = vi.fn(async (): Promise<FormState> => ({
      status: "success",
      savedAt: 1,
    }));
    render(
      <ToastProvider>
        <DeleteFileButton action={action} fileName="after.jpg" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete after.jpg" }));
    expect(action).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Delete this file?" });
    expect(dialog).toHaveTextContent("after.jpg will be deleted permanently.");

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete file" }),
      );
    });
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("File deleted.");
  });
});
