import { Badge } from "@/components/ui/badge";
import {
  ASSET_STATUS,
  ASSIGNMENT_STATUS,
  MAINTENANCE_PRIORITY,
  MAINTENANCE_STATUS,
} from "@/lib/labels";
import type { Enums } from "@/types/database";

export function AssetStatusBadge({
  status,
}: {
  status: Enums<"asset_status">;
}) {
  const { label, tone } = ASSET_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function AssignmentStatusBadge({
  status,
}: {
  status: Enums<"assignment_status">;
}) {
  const { label, tone } = ASSIGNMENT_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function MaintenanceStatusBadge({
  status,
}: {
  status: Enums<"maintenance_status">;
}) {
  const { label, tone } = MAINTENANCE_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function PriorityBadge({
  priority,
}: {
  priority: Enums<"maintenance_priority">;
}) {
  const { label, tone } = MAINTENANCE_PRIORITY[priority];
  return (
    <Badge tone={tone}>
      <span className="sr-only">Priority: </span>
      {label}
    </Badge>
  );
}
