import { MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { EvidenceList } from "@/components/files/evidence-list";
import { FileUploader } from "@/components/files/file-uploader";
import { AssignTechnicianForm } from "@/components/maintenance/assign-technician-form";
import { CancelRequestButton } from "@/components/maintenance/cancel-request-button";
import {
  RequestProgress,
  requestSteps,
} from "@/components/maintenance/request-progress";
import { ResolveForm } from "@/components/maintenance/resolve-form";
import { StartWorkButton } from "@/components/maintenance/start-work-button";
import { WorkLog } from "@/components/maintenance/work-log";
import { WorkNoteForm } from "@/components/maintenance/work-note-form";
import {
  AssetStatusBadge,
  MaintenanceStatusBadge,
  PriorityBadge,
} from "@/components/status-badges";
import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/current-user";
import {
  canWorkOnMaintenance,
  isAdmin,
  isTechnician,
} from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/format";
import { locationLabel } from "@/lib/locations/types";
import {
  addWorkNote,
  assignTechnician,
  cancelMaintenance,
  resolveMaintenance,
  startMaintenance,
} from "@/lib/maintenance/actions";
import {
  getMaintenanceRequest,
  listActiveTechnicians,
  listMaintenanceHistory,
} from "@/lib/maintenance/queries";
import {
  isStatusIn,
  OPEN_WORK_STATUSES,
  requestNumberParam,
  STATUS_EXPLANATIONS,
  UNFINISHED_STATUSES,
} from "@/lib/maintenance/schema";
import { deleteDocument, registerEvidence } from "@/lib/storage/actions";
import { EVIDENCE_TYPES } from "@/lib/storage/files";
import { listEvidence } from "@/lib/storage/queries";

export async function generateMetadata({
  params,
}: PageProps<"/maintenance/[requestNumber]">): Promise<Metadata> {
  const { requestNumber } = await params;
  return { title: requestNumber };
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function personName(
  person: { full_name: string | null; email: string | null } | null,
) {
  return person?.full_name ?? person?.email ?? "—";
}

/**
 * One maintenance request. RLS decides who may open it: the reporter, the
 * assigned technician and admins; anyone else gets "not found". Admins assign
 * technicians here; the assigned technician starts work, keeps the work log
 * (which reporters do not see), attaches evidence and resolves the request.
 * Admins can also resolve, or cancel a request before work starts.
 */
export default async function MaintenanceRequestPage({
  params,
}: PageProps<"/maintenance/[requestNumber]">) {
  const user = await requireUser();

  const { requestNumber } = await params;
  if (!requestNumberParam.safeParse(requestNumber).success) notFound();
  const request = await getMaintenanceRequest(requestNumber);
  if (!request) notFound();

  const admin = isAdmin(user);
  const assignedToMe = isTechnician(user) && request.assigned_to === user.id;
  const canWork = canWorkOnMaintenance(user, request);
  const canAddNotes = canWork && isStatusIn(request.status, OPEN_WORK_STATUSES);
  const canResolve = canWork && request.status === "IN_PROGRESS";
  const canCancel =
    admin && (request.status === "OPEN" || request.status === "ASSIGNED");
  const canStart = assignedToMe && request.status === "ASSIGNED";
  // Storage policies: admins at any time (a late invoice, say); the assigned
  // technician while the request is assigned or in progress.
  const canUpload = admin || (assignedToMe && canAddNotes);
  const [history, evidence, technicians] = await Promise.all([
    canWork ? listMaintenanceHistory(request.id) : null,
    canWork ? listEvidence(request.id) : null,
    admin && isStatusIn(request.status, UNFINISHED_STATUSES)
      ? listActiveTechnicians()
      : null,
  ]);

  const back = admin
    ? { href: "/admin/maintenance", label: "All maintenance" }
    : request.assigned_to === user.id
      ? { href: "/technician/maintenance", label: "My maintenance" }
      : { href: "/maintenance", label: "My requests" };
  const asset = request.assets;
  const steps = requestSteps({
    ...request,
    startedAt: history?.find((entry) => entry.action === "STARTED")
      ?.performed_at,
  });

  return (
    <>
      <BackLink href={back.href}>{back.label}</BackLink>
      <PageHeader
        title={request.request_number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <MaintenanceStatusBadge status={request.status} />
            <PriorityBadge priority={request.priority} />
            <span>{STATUS_EXPLANATIONS[request.status]}</span>
          </span>
        }
        actions={
          (canStart || canCancel) && (
            <>
              {canStart && (
                <StartWorkButton
                  action={startMaintenance.bind(
                    null,
                    request.id,
                    request.request_number,
                  )}
                />
              )}
              {canCancel && asset && (
                <CancelRequestButton
                  action={cancelMaintenance.bind(
                    null,
                    request.id,
                    request.request_number,
                    asset.asset_id,
                  )}
                  assetStatus={asset.status}
                />
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Problem">
            <p className="text-sm whitespace-pre-line text-slate-900">
              {request.description}
            </p>
            <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <Detail label="Reported by">
                {request.reported_by === user.id
                  ? "You"
                  : personName(request.reporter)}
                {admin && request.reporter?.email && (
                  <span className="block font-normal text-slate-600">
                    {request.reporter.email}
                  </span>
                )}
              </Detail>
              <Detail label="Reported">
                {formatDateTime(request.created_at)}
              </Detail>
            </dl>
          </Card>

          <Card title="Progress">
            <RequestProgress steps={steps} />
            <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-2">
              <Detail label="Technician">
                {request.assigned_to ? (
                  request.assigned_to === user.id ? (
                    "You"
                  ) : (
                    personName(request.technician)
                  )
                ) : (
                  <span className="font-normal text-slate-600">
                    Not assigned yet
                  </span>
                )}
              </Detail>
              <Detail label="Assigned">
                {formatDateTime(request.assigned_at)}
              </Detail>
              {request.status === "RESOLVED" && (
                <>
                  <Detail label="Resolved">
                    {formatDateTime(request.resolved_at)}
                  </Detail>
                  <div className="sm:col-span-2">
                    <Detail label="What was done">
                      <span className="font-normal whitespace-pre-line">
                        {request.resolution_notes}
                      </span>
                    </Detail>
                  </div>
                </>
              )}
              {request.status === "CANCELLED" && (
                <>
                  <Detail label="Closed">
                    {formatDateTime(request.cancelled_at)}
                  </Detail>
                  {request.cancellation_reason && (
                    <div className="sm:col-span-2">
                      <Detail label="Reason">
                        <span className="font-normal whitespace-pre-line">
                          {request.cancellation_reason}
                        </span>
                      </Detail>
                    </div>
                  )}
                </>
              )}
            </dl>
          </Card>

          {history && (
            <Card
              title="Work log"
              description="Visible to admins and the assigned technician only."
            >
              <WorkLog entries={history} viewerId={user.id} />
              {canAddNotes && (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Add a note
                  </h3>
                  <WorkNoteForm
                    action={addWorkNote.bind(
                      null,
                      request.id,
                      request.request_number,
                    )}
                  />
                </div>
              )}
            </Card>
          )}

          {evidence && (
            <Card
              title="Evidence"
              description="Photos and documents of the repair. Visible to admins and the assigned technician only."
            >
              <EvidenceList
                files={evidence}
                viewerId={user.id}
                deleteAction={
                  admin && asset
                    ? (documentId) =>
                        deleteDocument.bind(
                          null,
                          documentId,
                          asset.asset_id,
                          request.request_number,
                        )
                    : undefined
                }
              />
              {canUpload && (
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">
                    Add a file
                  </h3>
                  <FileUploader
                    types={EVIDENCE_TYPES}
                    entityId={request.id}
                    register={registerEvidence.bind(
                      null,
                      request.id,
                      request.request_number,
                    )}
                    buttonLabel="Upload file"
                    successMessage="File added."
                  />
                </div>
              )}
            </Card>
          )}

          {canResolve && asset && (
            <Card
              title="Resolve request"
              description="Close the request once the work is finished."
            >
              <ResolveForm
                action={resolveMaintenance.bind(
                  null,
                  request.id,
                  request.request_number,
                  asset.asset_id,
                )}
                assetStatus={asset.status}
                isAdmin={admin}
              />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {technicians && (
            <Card
              title={
                request.assigned_to
                  ? "Reassign technician"
                  : "Assign technician"
              }
            >
              <AssignTechnicianForm
                action={assignTechnician.bind(
                  null,
                  request.id,
                  request.request_number,
                )}
                technicians={technicians}
                currentTechnicianId={request.assigned_to}
              />
            </Card>
          )}

          {asset && (
            <Card title="Asset">
              <Link
                href={`/assets/${asset.asset_id}`}
                className="font-medium text-blue-700 hover:underline"
              >
                {asset.name}
              </Link>
              <p className="font-mono text-xs text-slate-500">
                {asset.asset_id}
              </p>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>
                  <AssetStatusBadge status={asset.status} />
                </p>
                <p className="flex items-start gap-1.5">
                  <MapPin
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-slate-400"
                  />
                  <span>
                    {locationLabel(asset.buildings, asset.rooms)}
                    {asset.rooms?.display_name && (
                      <span className="block">{asset.rooms.display_name}</span>
                    )}
                  </span>
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
