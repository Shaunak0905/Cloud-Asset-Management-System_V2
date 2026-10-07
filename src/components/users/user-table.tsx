import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/types";
import type { FormAction, FormState } from "@/lib/forms";
import { formatCampusDate } from "@/lib/format";

import { AccountStatusButton } from "./account-status-button";
import { RoleForm } from "./role-form";

export type UserTableRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  department: string | null;
  is_active: boolean;
  created_at: string;
};

const ROLE_TONES: Record<UserRole, "red" | "purple" | "blue" | "neutral"> = {
  ADMIN: "red",
  TECHNICIAN: "purple",
  STAFF: "blue",
  STUDENT: "neutral",
};

/**
 * Users with their role and account status, and the admin's controls to
 * change them. The signed-in admin's own row has no controls: the database
 * refuses self-changes so nobody can lock themselves out by accident.
 */
export function UserTable({
  rows,
  viewerId,
  roleAction,
  statusAction,
}: {
  rows: UserTableRow[];
  viewerId: string;
  roleAction: (userId: string) => FormAction;
  statusAction: (userId: string, active: boolean) => () => Promise<FormState>;
}) {
  return (
    <Table caption="Users">
      <TableHead>
        <tr>
          <TableHeaderCell>User</TableHeaderCell>
          <TableHeaderCell>Role</TableHeaderCell>
          <TableHeaderCell>Department</TableHeaderCell>
          <TableHeaderCell>Account</TableHeaderCell>
          <TableHeaderCell>Joined</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const self = row.id === viewerId;
          return (
            <TableRow key={row.id}>
              <TableCell>
                <p className="font-medium text-slate-900">
                  {row.full_name}
                  {self && <span className="text-slate-500"> (you)</span>}
                </p>
                {row.email && (
                  <p className="text-xs text-slate-500">{row.email}</p>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {self ? (
                  <Badge tone={ROLE_TONES[row.role]}>
                    {ROLE_LABELS[row.role]}
                  </Badge>
                ) : (
                  <RoleForm
                    action={roleAction(row.id)}
                    role={row.role}
                    userId={row.id}
                    userName={row.full_name}
                  />
                )}
              </TableCell>
              <TableCell>{row.department ?? "—"}</TableCell>
              <TableCell>
                <Badge tone={row.is_active ? "green" : "neutral"}>
                  {row.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatCampusDate(row.created_at)}
              </TableCell>
              <TableCell className="text-right">
                {!self && (
                  <AccountStatusButton
                    action={statusAction(row.id, !row.is_active)}
                    active={row.is_active}
                    userName={row.full_name}
                  />
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
