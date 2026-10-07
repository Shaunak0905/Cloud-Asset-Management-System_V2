import { z } from "zod";

import { normalizeActorSearch } from "@/lib/audit/schema";
import { Constants, type Enums } from "@/types/database";

type UserRole = Enums<"user_role">;

export const USERS_PAGE_SIZE = 20;

export type UserStatusFilter = "active" | "inactive";

export type UserListParams = {
  /** Part of a name or email (sanitised for a quoted PostgREST filter). */
  search: string | null;
  role: UserRole | null;
  status: UserStatusFilter | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const MAX_PAGE = 10_000;

/** Parses user list filters from the URL; invalid values are ignored. */
export function parseUserListParams(params: SearchParams): UserListParams {
  const role = first(params.role);
  const status = first(params.status);
  const page = Number.parseInt(first(params.page), 10);
  return {
    search: normalizeActorSearch(first(params.search)),
    role: Constants.public.Enums.user_role.find((r) => r === role) ?? null,
    status: status === "active" || status === "inactive" ? status : null,
    page: Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1,
  };
}

export function userListQuery(params: UserListParams): string {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  if (params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function hasUserFilters(params: UserListParams): boolean {
  return Boolean(params.search || params.role || params.status);
}

export const roleChangeSchema = z.object({
  role: z.enum(Constants.public.Enums.user_role, "Choose a role."),
});
