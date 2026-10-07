import { SignOutButton } from "@/components/auth/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/types";

/** Who is signed in, plus sign-out. Shown at the bottom of the navigation. */
export function UserPanel({ user }: { user: CurrentUser }) {
  return (
    <div className="border-t border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {user.fullName}
          </p>
          {user.email && (
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          )}
        </div>
        <Badge tone="blue">{ROLE_LABELS[user.role]}</Badge>
      </div>
      <div className="mt-3">
        <SignOutButton />
      </div>
    </div>
  );
}
