"use client";

import { Upload } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { controlClasses, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";
import {
  type DocumentType,
  isAllowedFor,
  UPLOAD_KINDS,
} from "@/lib/storage/files";
import {
  type UploadedFile,
  uploadFile,
  type UploadResult,
} from "@/lib/storage/upload";
import { cn } from "@/lib/utils/cn";

type Step = "idle" | "uploading" | "saving";

/**
 * Chooses and uploads one file (docs/09 §12, §16; docs/10 §56). The file
 * goes from the browser straight to its private bucket, then `register`
 * (a Server Action) records it. Says which files are accepted, reports
 * problems in plain words, and clears itself after a successful upload.
 *
 * With several `types` the user first says what the file is, which also
 * decides which files the picker offers.
 */
export function FileUploader({
  types,
  entityId,
  register,
  buttonLabel = "Upload",
  successMessage = "File uploaded.",
  upload = uploadFile,
}: {
  types: readonly DocumentType[];
  /** The asset or maintenance request the file belongs to. */
  entityId: string;
  register: (type: DocumentType, file: UploadedFile) => Promise<FormState>;
  buttonLabel?: string;
  successMessage?: string;
  /** Replaceable for tests and the UI gallery. */
  upload?: (
    file: File,
    type: DocumentType,
    entityId: string,
  ) => Promise<UploadResult>;
}) {
  const [type, setType] = useState<DocumentType>(types[0]);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const kind = UPLOAD_KINDS[type];
  const hint = `${kind.accepts} · up to 10 MB`;
  const busy = step !== "idle";

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function choose(chosen: File | null, forType: DocumentType) {
    setFile(chosen);
    setError(
      chosen && !isAllowedFor(forType, chosen.type)
        ? `Choose a ${UPLOAD_KINDS[forType].accepts} file.`
        : null,
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setError(null);

    setStep("uploading");
    const uploaded = await upload(file, type, entityId);
    if (!uploaded.ok) {
      setStep("idle");
      setError(uploaded.message);
      return;
    }

    setStep("saving");
    const result = await register(type, uploaded.file);
    setStep("idle");
    if (result.status !== "success") {
      setError(result.message ?? "Upload failed. Please try again.");
      return;
    }
    clearFile();
    toast({ tone: "success", title: successMessage });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-3" aria-busy={busy}>
      {error && <Alert tone="error">{error}</Alert>}

      {types.length > 1 && (
        <Field id="upload-type" label="What is it?">
          <Select
            id="upload-type"
            value={type}
            disabled={busy}
            onChange={(event) => {
              const next = event.target.value as DocumentType;
              setType(next);
              // The picker offers different files for a different type.
              clearFile();
              setError(null);
            }}
            className="sm:max-w-xs"
          >
            {types.map((option) => (
              <option key={option} value={option}>
                {UPLOAD_KINDS[option].label} ({UPLOAD_KINDS[option].accepts})
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field id="upload-file" label="File" hint={hint}>
        <input
          ref={inputRef}
          id="upload-file"
          type="file"
          accept={kind.mimeTypes.join(",")}
          disabled={busy}
          onChange={(event) => choose(event.target.files?.[0] ?? null, type)}
          aria-describedby={describedBy("upload-file", { hint })}
          className={cn(
            controlClasses,
            "h-auto py-1.5 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-900",
          )}
        />
      </Field>

      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={!file || busy || error !== null}
      >
        <Upload aria-hidden className="size-4" />
        {step === "uploading"
          ? "Uploading…"
          : step === "saving"
            ? "Saving…"
            : buttonLabel}
      </Button>
    </form>
  );
}
