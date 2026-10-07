"use client";

import { useState } from "react";

import {
  BuildingRoomSelector,
  type LocationValue,
} from "@/components/locations/building-room-selector";
import {
  type EvidenceItem,
  EvidenceList,
} from "@/components/files/evidence-list";
import { FileUploader } from "@/components/files/file-uploader";
import {
  AssignTechnicianForm,
  type TechnicianChoice,
} from "@/components/maintenance/assign-technician-form";
import { CancelRequestButton } from "@/components/maintenance/cancel-request-button";
import { ResolveForm } from "@/components/maintenance/resolve-form";
import { StartWorkButton } from "@/components/maintenance/start-work-button";
import { WorkLog, type WorkLogEntry } from "@/components/maintenance/work-log";
import { WorkNoteForm } from "@/components/maintenance/work-note-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserTable } from "@/components/users/user-table";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/forms";
import { formatFileSize } from "@/lib/format";
import type { BuildingOption, RoomOption } from "@/lib/locations/types";
import {
  type AllowedMimeType,
  type DocumentType,
  EVIDENCE_TYPES,
  fileProblem,
  SNIFF_BYTES,
  sniffMimeType,
} from "@/lib/storage/files";
import { downscaleImage } from "@/lib/storage/image";
import type { UploadResult } from "@/lib/storage/upload";

const DEMO_BUILDINGS: BuildingOption[] = [
  { id: "demo-vy", name: "Vyas", code: "VY" },
  { id: "demo-vk", name: "Vivekananda", code: "VK" },
  { id: "demo-empty", name: "New Block", code: "NB" },
  { id: "demo-broken", name: "Offline Block", code: "OB" },
];

const DEMO_ROOMS: Record<string, RoomOption[]> = {
  "demo-vy": [
    { id: "vy001", room_number: "VY001", display_name: "Seminar Hall" },
    { id: "vy101", room_number: "VY101", display_name: "Computer Lab 1" },
    { id: "vy201", room_number: "VY201", display_name: "Faculty Room" },
  ],
  "demo-vk": [
    { id: "vk301", room_number: "VK301", display_name: "Electronics Lab" },
    { id: "vk404", room_number: "VK404", display_name: "Classroom 404" },
  ],
  "demo-empty": [],
};

/** Sample loader with a delay; "Offline Block" always fails. */
function loadDemoRooms(buildingId: string): Promise<RoomOption[]> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      const rooms = DEMO_ROOMS[buildingId];
      if (rooms) resolve(rooms);
      else reject(new Error("demo failure"));
    }, 700),
  );
}

export function LocationSelectorDemo() {
  const [value, setValue] = useState<LocationValue>({
    buildingId: null,
    roomId: null,
  });
  return (
    <div className="space-y-3">
      <BuildingRoomSelector
        buildings={DEMO_BUILDINGS}
        loadRooms={loadDemoRooms}
        buildingLabel="Usage building"
        roomLabel="Usage room"
        onChange={setValue}
      />
      <p className="font-mono text-xs text-slate-500">
        {JSON.stringify(value)}
      </p>
    </div>
  );
}

export function InteractiveDemos() {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="danger" onClick={() => setOpen(true)}>
        Retire asset…
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({ tone: "success", title: "Asset created successfully." })
        }
      >
        Success toast
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            tone: "error",
            title: "Upload failed",
            description: "Check the file type and size, then try again.",
          })
        }
      >
        Error toast
      </Button>

      <ConfirmDialog
        open={open}
        tone="danger"
        title="Retire this asset?"
        description="This will prevent future assignments while preserving its history."
        confirmLabel="Retire asset"
        onConfirm={() => {
          setOpen(false);
          toast({ tone: "success", title: "Asset retired." });
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

const DEMO_TECHNICIANS: TechnicianChoice[] = [
  { id: "demo-ravi", full_name: "Ravi Kumar", email: "ravi@campus.edu" },
  { id: "demo-priya", full_name: "Priya Shah", email: "priya@campus.edu" },
];

const DEMO_LOG: WorkLogEntry[] = [
  {
    id: "log-1",
    action: "REPORTED",
    notes: null,
    performed_at: "2026-10-01T04:10:00Z",
    performed_by: "demo-student",
    performer: { full_name: "Asha Rao" },
  },
  {
    id: "log-2",
    action: "ASSIGNED",
    notes: "Assigned to Ravi Kumar",
    performed_at: "2026-10-01T05:02:00Z",
    performed_by: "demo-admin",
    performer: null,
  },
  {
    id: "log-3",
    action: "STARTED",
    notes: null,
    performed_at: "2026-10-01T06:15:00Z",
    performed_by: "demo-ravi",
    performer: { full_name: "Ravi Kumar" },
  },
  {
    id: "log-4",
    action: "DIAGNOSIS",
    notes: "HDMI input board is faulty; ordered a replacement.",
    performed_at: "2026-10-01T06:40:00Z",
    performed_by: "demo-ravi",
    performer: { full_name: "Ravi Kumar" },
  },
];

/** Pretends to save after a short delay. */
function demoSave(): Promise<FormState> {
  return new Promise((resolve) =>
    setTimeout(() => resolve({ status: "success", savedAt: Date.now() }), 500),
  );
}

/** Pretends to close a request; the asset ends up in the chosen state. */
function demoClose(_state: FormState, formData: FormData): Promise<FormState> {
  const assetStatus = String(formData.get("assetStatus") ?? "") || "AVAILABLE";
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          status: "success",
          savedAt: Date.now(),
          values: { assetStatus },
        }),
      500,
    ),
  );
}

/** The technician workflow controls with sample data (no database). */
export function TechnicianWorkflowDemo() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Assign technician (admin)
        </h3>
        <AssignTechnicianForm
          action={demoSave}
          technicians={DEMO_TECHNICIANS}
          currentTechnicianId={null}
        />
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Start work · cancel (admin)
        </h3>
        <div className="flex flex-wrap gap-2">
          <StartWorkButton action={demoSave} />
          <CancelRequestButton
            action={demoClose}
            assetStatus="IN_MAINTENANCE"
          />
        </div>
      </div>
      <div className="space-y-4 md:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900">Work log</h3>
        <WorkLog entries={DEMO_LOG} viewerId="demo-ravi" />
        <WorkNoteForm action={demoSave} />
      </div>
      <div className="space-y-3 md:col-span-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Resolve request (admin view, asset in maintenance)
        </h3>
        <ResolveForm action={demoClose} assetStatus="IN_MAINTENANCE" isAdmin />
      </div>
    </div>
  );
}

const DEMO_EVIDENCE: EvidenceItem[] = [
  {
    id: "demo-photo",
    original_filename: "burnt-board.jpg",
    mime_type: "image/jpeg",
    file_size_bytes: 412_000,
    document_type: "MAINTENANCE_IMAGE",
    created_at: "2026-10-02T06:40:00Z",
    uploaded_by: "demo-ravi",
    uploader: { full_name: "Ravi Kumar" },
  },
  {
    id: "demo-report",
    original_filename: "service-report.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1_250_000,
    document_type: "SERVICE_REPORT",
    created_at: "2026-10-02T08:05:00Z",
    uploaded_by: "demo-admin",
    uploader: null,
  },
];

/**
 * The uploader and evidence list with sample data. The real browser-side
 * steps run (photo downscaling, type, size and content checks) but nothing
 * is sent to storage; the sample files do not exist, so the photo shows the
 * "Image unavailable" fallback.
 */
export function StorageDemo() {
  const [last, setLast] = useState<string | null>(null);

  async function demoUpload(
    original: File,
    type: DocumentType,
  ): Promise<UploadResult> {
    const file = await downscaleImage(original);
    const problem = fileProblem(file, type);
    if (problem) return { ok: false, message: problem };
    const head = new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
    if (sniffMimeType(head) !== file.type) {
      return {
        ok: false,
        message: "This file's content is not what it claims.",
      };
    }
    setLast(
      `${original.name}: ${formatFileSize(original.size)} → ${formatFileSize(file.size)} (${file.type})`,
    );
    return {
      ok: true,
      file: {
        path: "demo",
        originalFilename: original.name,
        mimeType: file.type as AllowedMimeType,
        size: file.size,
      },
    };
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Evidence</h3>
        <EvidenceList
          files={DEMO_EVIDENCE}
          viewerId="demo-ravi"
          deleteAction={() => demoSave}
        />
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Add a file</h3>
        <FileUploader
          types={EVIDENCE_TYPES}
          entityId="demo"
          register={demoSave}
          upload={demoUpload}
          buttonLabel="Upload file"
          successMessage="File added."
        />
        {last && (
          <p
            className="font-mono text-xs text-slate-500"
            data-testid="demo-upload"
          >
            {last}
          </p>
        )}
      </div>
    </div>
  );
}

/** The admin user table with sample people; changes are simulated. */
export function UsersDemo() {
  return (
    <UserTable
      viewerId="demo-admin"
      roleAction={() => demoSave}
      statusAction={() => demoSave}
      rows={[
        {
          id: "demo-admin",
          full_name: "Asha Admin",
          email: "asha@campus.edu",
          role: "ADMIN",
          department: "Administration",
          is_active: true,
          created_at: "2026-09-28T05:00:00Z",
        },
        {
          id: "demo-ravi",
          full_name: "Ravi Kumar",
          email: "ravi@campus.edu",
          role: "TECHNICIAN",
          department: "Maintenance",
          is_active: true,
          created_at: "2026-09-29T05:00:00Z",
        },
        {
          id: "demo-old",
          full_name: "Old Student",
          email: "old@campus.edu",
          role: "STUDENT",
          department: null,
          is_active: false,
          created_at: "2026-09-30T05:00:00Z",
        },
      ]}
    />
  );
}
