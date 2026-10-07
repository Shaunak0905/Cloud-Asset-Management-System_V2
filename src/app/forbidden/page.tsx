import type { Metadata } from "next";
import Link from "next/link";

import { MessagePage } from "@/components/layout/message-page";
import { buttonClasses } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { homePathForRole } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Access denied" };

export default async function ForbiddenPage() {
  const user = await getCurrentUser();

  return (
    <MessagePage
      eyebrow="403"
      title="Access denied"
      actions={
        <Link
          href={user ? homePathForRole(user.role) : "/"}
          className={buttonClasses()}
        >
          {user ? "Go to your dashboard" : "Back to home"}
        </Link>
      }
    >
      <p>You do not have permission to view that page.</p>
    </MessagePage>
  );
}
