import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { UserFilters } from "@/components/users/user-filters";
import { UserTable } from "@/components/users/user-table";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireRole } from "@/lib/auth/current-user";
import { changeUserRole, setUserActive } from "@/lib/users/actions";
import { listUsers } from "@/lib/users/queries";
import {
  hasUserFilters,
  parseUserListParams,
  USERS_PAGE_SIZE,
  userListQuery,
} from "@/lib/users/schema";

export const metadata: Metadata = { title: "Users" };

const BASE_PATH = "/admin/users";

/**
 * Admin user management (docs/05 §23–24): find users, change roles and
 * activate/deactivate accounts. Changes go through audited database
 * functions; accounts themselves are created in Supabase Auth.
 */
export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  const admin = await requireRole(["ADMIN"]);

  const params = parseUserListParams(await searchParams);
  const { rows, total } = await listUsers(params);
  const hrefFor = (page: number) =>
    `${BASE_PATH}${userListQuery({ ...params, page })}`;
  const filtered = hasUserFilters(params);

  return (
    <>
      <PageHeader
        title="Users"
        description="Roles and account status. Role and status changes are recorded in the audit log."
      />

      <Alert tone="info" title="Adding people" className="mb-4">
        New accounts are created in the Supabase dashboard under Authentication
        → Users → Add user (tick “Auto Confirm User”). They start as Students;
        change their role here.
      </Alert>

      <UserFilters basePath={BASE_PATH} params={params} />

      {total === null ? (
        <EmptyState
          title="This page is empty"
          description="The list is shorter than the page you asked for."
          action={
            <Link
              href={hrefFor(1)}
              className={buttonClasses({ variant: "secondary" })}
            >
              Go to the first page
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "No users match your filters" : "No users yet"}
          description={
            filtered
              ? "Try a different search or clear the filters."
              : "Accounts created in Supabase Auth appear here."
          }
          action={
            filtered ? (
              <Link
                href={BASE_PATH}
                className={buttonClasses({ variant: "secondary" })}
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <UserTable
            rows={rows}
            viewerId={admin.id}
            roleAction={(userId) => changeUserRole.bind(null, userId)}
            statusAction={(userId, active) =>
              setUserActive.bind(null, userId, active)
            }
          />
          <Pagination
            page={params.page}
            pageSize={USERS_PAGE_SIZE}
            total={total}
            hrefFor={hrefFor}
            label="users"
          />
        </>
      )}
    </>
  );
}
