"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assetIdParam } from "@/lib/assets/schema";
import { requireRole, requireUser } from "@/lib/auth/current-user";
import {
  type DbError,
  isPermissionError,
  PG_CHECK_VIOLATION,
} from "@/lib/db-errors";
import { withFlash } from "@/lib/flash";
import { type FormState, invalidForm, readFields } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import {
  assignTechnicianSchema,
  CANCEL_FORM_FIELDS,
  cancelSchema,
  MAINTENANCE_ERRORS,
  REPORT_FORM_FIELDS,
  reportProblemSchema,
  requestNumberParam,
  RESOLVE_FORM_FIELDS,
  resolveSchema,
  TECHNICIAN_FORM_FIELDS,
  WORK_NOTE_FORM_FIELDS,
  workNoteSchema,
} from "./schema";

const ASSET_GONE = "This asset no longer exists.";
const REQUEST_GONE = "This maintenance request no longer exists.";
const CLOSED = "This request has been closed, so it can no longer change.";

/**
 * Reports a problem with an asset. The report_problem database function
 * records the signed-in user as the reporter (never a form value), opens the
 * request, writes its history and audit entries and, for HIGH/CRITICAL
 * problems, takes an available asset out of service — in one transaction.
 */
export async function reportProblem(
  id: string,
  assetId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  if (
    !z.uuid().safeParse(id).success ||
    !assetIdParam.safeParse(assetId).success
  ) {
    return { status: "error", message: ASSET_GONE };
  }

  const values = readFields(formData, REPORT_FORM_FIELDS);
  const parsed = reportProblemSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { data: requestNumber, error } = await supabase.rpc("report_problem", {
    p_asset_id: id,
    p_description: parsed.data.description,
    p_priority: parsed.data.priority,
  });

  if (error) {
    if (error.code === MAINTENANCE_ERRORS.retired) {
      return {
        status: "error",
        message:
          "This asset has been retired, so problems can no longer be reported for it.",
      };
    }
    if (error.code === "P0002") return { status: "error", message: ASSET_GONE };
    if (error.code === PG_CHECK_VIOLATION) {
      return {
        status: "error",
        fieldErrors: { description: ["Describe the problem."] },
        values,
      };
    }
    if (isPermissionError(error)) {
      return {
        status: "error",
        message: "Your account cannot report problems.",
        values,
      };
    }
    console.error("[maintenance] report failed:", error.code, error.message);
    return {
      status: "error",
      message: "Unable to send the report. Please try again.",
      values,
    };
  }

  revalidatePath("/assets");
  revalidatePath("/admin/assets");
  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/maintenance");
  revalidatePath("/admin/maintenance");
  redirect(withFlash(`/maintenance/${requestNumber}`, "problem-reported"));
}

// --- Technician workflow ----------------------------------------------------------

function isValidRequest(id: string, requestNumber: string): boolean {
  return (
    z.uuid().safeParse(id).success &&
    requestNumberParam.safeParse(requestNumber).success
  );
}

function revalidateRequestPages(requestNumber: string) {
  revalidatePath(`/maintenance/${requestNumber}`);
  revalidatePath("/maintenance");
  revalidatePath("/admin/maintenance");
  revalidatePath("/technician");
  revalidatePath("/technician/maintenance");
}

/** Closing a request can change its asset's status. */
function revalidateAssetPages(assetId: string) {
  revalidatePath("/assets");
  revalidatePath("/admin/assets");
  revalidatePath(`/assets/${assetId}`);
}

/**
 * Maps the workflow functions' errors to messages. Database messages are
 * never shown; unexpected errors are logged.
 */
function workflowError(
  error: DbError,
  values: Record<string, string> | undefined,
  messages: { permission: string; fallback: string; wrongStep?: string },
): FormState {
  switch (error.code) {
    case MAINTENANCE_ERRORS.closed:
      return { status: "error", message: CLOSED };
    case MAINTENANCE_ERRORS.wrongStep:
      return {
        status: "error",
        message:
          messages.wrongStep ?? "Assign a technician before work can start.",
      };
    case MAINTENANCE_ERRORS.invalidAssetState:
      return {
        status: "error",
        fieldErrors: {
          assetStatus: [
            "This choice is no longer possible for the asset. Reload the page and choose again.",
          ],
        },
        values,
      };
    case MAINTENANCE_ERRORS.notTechnician:
      return {
        status: "error",
        fieldErrors: {
          technicianId: [
            "This person is no longer an active technician. Choose someone else.",
          ],
        },
        values,
      };
    case "P0002":
      return { status: "error", message: REQUEST_GONE };
  }
  if (isPermissionError(error)) {
    return { status: "error", message: messages.permission, values };
  }
  console.error("[maintenance] workflow failed:", error.code, error.message);
  return { status: "error", message: messages.fallback, values };
}

/**
 * Admin: assigns the request to an active technician, or hands it to a
 * different one. assign_technician checks the technician, records history
 * and audit, and refuses closed requests.
 */
export async function assignTechnician(
  id: string,
  requestNumber: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  if (!isValidRequest(id, requestNumber)) {
    return { status: "error", message: REQUEST_GONE };
  }

  const values = readFields(formData, TECHNICIAN_FORM_FIELDS);
  const parsed = assignTechnicianSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_technician", {
    p_request_id: id,
    p_technician_id: parsed.data.technicianId,
  });
  if (error) {
    return workflowError(error, values, {
      permission: "Only admins can assign technicians.",
      fallback: "Unable to assign the technician. Please try again.",
    });
  }

  revalidateRequestPages(requestNumber);
  return { status: "success", savedAt: Date.now(), values };
}

/**
 * Starts work (ASSIGNED -> IN_PROGRESS). start_maintenance allows only the
 * assigned technician or an admin. Returns a result (not a redirect) so the
 * button can show feedback in place.
 */
export async function startMaintenance(
  id: string,
  requestNumber: string,
): Promise<FormState> {
  await requireUser();
  if (!isValidRequest(id, requestNumber)) {
    return { status: "error", message: REQUEST_GONE };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_maintenance", {
    p_request_id: id,
  });
  if (error) {
    return workflowError(error, undefined, {
      permission: "Only the technician assigned to this request can start it.",
      fallback: "Unable to start work. Please try again.",
    });
  }

  revalidateRequestPages(requestNumber);
  return { status: "success", savedAt: Date.now() };
}

/**
 * Adds a work note (inspection, diagnosis, repair, …) to the request's
 * history. RLS allows it only for the assigned technician or an admin, while
 * the request is assigned or in progress; the author is set by the database
 * and the entry is audited.
 */
export async function addWorkNote(
  id: string,
  requestNumber: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  if (!isValidRequest(id, requestNumber)) {
    return { status: "error", message: REQUEST_GONE };
  }

  const values = readFields(formData, WORK_NOTE_FORM_FIELDS);
  const parsed = workNoteSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("maintenance_history").insert({
    maintenance_request_id: id,
    action: parsed.data.action,
    notes: parsed.data.notes,
  });
  if (error) {
    if (error.code === PG_CHECK_VIOLATION) {
      return {
        status: "error",
        fieldErrors: { notes: ["Write what you found or did."] },
        values,
      };
    }
    if (isPermissionError(error)) {
      return {
        status: "error",
        message:
          "Notes can only be added by the assigned technician while the request is assigned or in progress.",
        values,
      };
    }
    console.error("[maintenance] note failed:", error.code, error.message);
    return {
      status: "error",
      message: "Unable to save the note. Please try again.",
      values,
    };
  }

  revalidateRequestPages(requestNumber);
  return { status: "success", savedAt: Date.now() };
}

/**
 * Resolves an IN_PROGRESS request with what was done and the asset's final
 * state. resolve_maintenance checks the caller (assigned technician or
 * admin), the step and the state (only admins retire), then updates the
 * request, history, asset and audit log together. Returns the asset's
 * resulting status, which can differ from the choice (e.g. it stays in
 * maintenance while another serious problem is open).
 */
export async function resolveMaintenance(
  id: string,
  requestNumber: string,
  assetId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  if (
    !isValidRequest(id, requestNumber) ||
    !assetIdParam.safeParse(assetId).success
  ) {
    return { status: "error", message: REQUEST_GONE };
  }

  const values = readFields(formData, RESOLVE_FORM_FIELDS);
  const parsed = resolveSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { data: finalStatus, error } = await supabase.rpc(
    "resolve_maintenance",
    {
      p_request_id: id,
      p_resolution_notes: parsed.data.resolutionNotes,
      p_asset_status: parsed.data.assetStatus,
    },
  );
  if (error) {
    if (error.code === PG_CHECK_VIOLATION) {
      return {
        status: "error",
        fieldErrors: { resolutionNotes: ["Describe what was done."] },
        values,
      };
    }
    return workflowError(error, values, {
      permission:
        "Only the assigned technician or an admin can resolve this request with that choice.",
      fallback: "Unable to resolve the request. Please try again.",
      wrongStep: "Start work before resolving the request.",
    });
  }

  revalidateRequestPages(requestNumber);
  revalidateAssetPages(assetId);
  return {
    status: "success",
    savedAt: Date.now(),
    values: { assetStatus: finalStatus },
  };
}

/**
 * Admin: cancels an OPEN or ASSIGNED request (e.g. a duplicate) with a reason
 * the reporter can read. cancel_maintenance releases an asset that the
 * request took out of service, and returns the asset's resulting status.
 */
export async function cancelMaintenance(
  id: string,
  requestNumber: string,
  assetId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["ADMIN"]);
  if (
    !isValidRequest(id, requestNumber) ||
    !assetIdParam.safeParse(assetId).success
  ) {
    return { status: "error", message: REQUEST_GONE };
  }

  const values = readFields(formData, CANCEL_FORM_FIELDS);
  const parsed = cancelSchema.safeParse(values);
  if (!parsed.success) return invalidForm(parsed.error, values);

  const supabase = await createClient();
  const { data: finalStatus, error } = await supabase.rpc(
    "cancel_maintenance",
    { p_request_id: id, p_reason: parsed.data.reason },
  );
  if (error) {
    if (error.code === PG_CHECK_VIOLATION) {
      return {
        status: "error",
        fieldErrors: { reason: ["Say why the request is being cancelled."] },
        values,
      };
    }
    return workflowError(error, values, {
      permission: "Only admins can cancel requests.",
      fallback: "Unable to cancel the request. Please try again.",
      wrongStep:
        "Work has already started, so the request cannot be cancelled. The technician can resolve it instead.",
    });
  }

  revalidateRequestPages(requestNumber);
  revalidateAssetPages(assetId);
  return {
    status: "success",
    savedAt: Date.now(),
    values: { assetStatus: finalStatus },
  };
}
