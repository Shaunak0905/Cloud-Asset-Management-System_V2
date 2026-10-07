import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { countUnreadNotifications } from "@/lib/notifications/queries";

// Frame for signed-in pages. The layout only DISPLAYS the user: each page
// enforces access with requireUser()/requireRole(), because layouts are not
// re-rendered on client-side navigation.

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    // The page's guard redirects; render nothing that needs a user meanwhile.
    return <main className="flex-1">{children}</main>;
  }
  // Layouts are not re-rendered on client navigation; actions that change
  // the count revalidate the layout.
  const unread = await countUnreadNotifications(user.id);
  return (
    <AppShell user={user} unreadNotifications={unread}>
      {children}
    </AppShell>
  );
}
