import type { Enums } from "@/types/database";

export type UserRole = Enums<"user_role">;

/** The signed-in, active user as the application sees them. */
export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  role: UserRole;
  department: string | null;
};
