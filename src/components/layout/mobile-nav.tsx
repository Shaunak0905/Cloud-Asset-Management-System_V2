"use client";

import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { CurrentUser } from "@/lib/auth/types";

import { Brand } from "./brand";
import { SidebarNav } from "./sidebar-nav";
import { UserPanel } from "./user-panel";

/** Top bar with a slide-in navigation drawer, shown below the lg breakpoint. */
export function MobileNav({
  user,
  home,
  unreadNotifications = 0,
}: {
  user: CurrentUser;
  home: string;
  unreadNotifications?: number;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden print:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          className="-ml-1 rounded-md p-1.5 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <Menu aria-hidden className="size-6" />
          <span className="sr-only">Open navigation</span>
        </button>
        <Brand href={home} />
        <Link
          href="/notifications"
          className="relative ml-auto rounded-md p-1.5 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"
        >
          <Bell aria-hidden className="size-6" />
          <span className="sr-only">
            Notifications
            {unreadNotifications > 0 ? ` (${unreadNotifications} unread)` : ""}
          </span>
          {unreadNotifications > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-blue-700 px-1 text-center text-xs leading-5 font-semibold text-white"
            >
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </Link>
      </div>

      <dialog
        id="mobile-navigation"
        ref={dialogRef}
        aria-label="Navigation"
        onClose={close}
        // A click on the backdrop lands on the <dialog> element itself.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="m-0 h-dvh max-h-none w-72 max-w-[85vw] bg-white p-0 shadow-xl backdrop:bg-slate-900/40 lg:hidden"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
            <Brand href={home} />
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <X aria-hidden className="size-5" />
              <span className="sr-only">Close navigation</span>
            </button>
          </div>
          <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav
              role={user.role}
              badges={{ "/notifications": unreadNotifications }}
              onNavigate={close}
            />
          </nav>
          <UserPanel user={user} />
        </div>
      </dialog>
    </>
  );
}
