import { Search } from "lucide-react";
import Form from "next/form";
import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { hasUserFilters, type UserListParams } from "@/lib/users/schema";
import { Constants } from "@/types/database";

/** Search and filters for the user list, kept in the URL. */
export function UserFilters({
  basePath,
  params,
}: {
  basePath: string;
  params: UserListParams;
}) {
  return (
    <Form
      action={basePath}
      role="search"
      aria-label="Filter users"
      className="mb-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <div className="relative">
          <label htmlFor="user-search" className="sr-only">
            Search by name or email
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            id="user-search"
            name="search"
            type="search"
            placeholder="Search by name or email"
            defaultValue={params.search ?? ""}
            className="pl-9"
          />
        </div>
        <FilterSelect
          id="user-role"
          name="role"
          label="Role"
          allLabel="All roles"
          value={params.role}
        >
          {Constants.public.Enums.user_role.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          id="user-status"
          name="status"
          label="Account status"
          allLabel="Active and inactive"
          value={params.status}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </FilterSelect>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {hasUserFilters(params) && (
          <Link
            href={basePath}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Clear filters
          </Link>
        )}
        <Button type="submit" size="sm">
          Apply
        </Button>
      </div>
    </Form>
  );
}
