import { Suspense, type ReactNode } from "react";

import { FlashToast } from "@/components/flash-toast";
import { homePathForRole } from "@/lib/auth/routes";
import type { CurrentUser } from "@/lib/auth/types";

import { Brand } from "./brand";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";
import { UserPanel } from "./user-panel";

/**
 * Signed-in application frame: fixed sidebar on desktop, top bar + drawer on
 * mobile. Navigation depends on role, but hiding links is not security: pages
 * check access themselves and RLS protects the data.
 */
export function AppShell({
  user,
  unreadNotifications = 0,
  children,
}: {
  user: CurrentUser;
  /** Unread notifications, shown as a badge on the Notifications link. */
  unreadNotifications?: number;
  children: ReactNode;
}) {
  const home = homePathForRole(user.role);
  const badges = { "/notifications": unreadNotifications };

  return (
    <div className="min-h-full flex-1 bg-slate-50 print:bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to main content
      </a>

      {/* Navigation is hidden when printing (e.g. QR labels). */}
      <aside className="hidden border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col print:hidden">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Brand href={home} />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav role={user.role} badges={badges} />
        </nav>
        <UserPanel user={user} />
      </aside>

      <MobileNav
        user={user}
        home={home}
        unreadNotifications={unreadNotifications}
      />

      {/* Reads the URL, so it must sit inside a Suspense boundary. */}
      <Suspense fallback={null}>
        <FlashToast />
      </Suspense>

      <div className="lg:pl-64 print:pl-0">
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
