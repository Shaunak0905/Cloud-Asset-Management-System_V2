import { CalendarClock, ShieldAlert } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const ICONS: Record<string, typeof CalendarClock> = {
  ASSIGNMENT_OVERDUE: CalendarClock,
  WARRANTY_EXPIRING: ShieldAlert,
};

/**
 * The user's notifications, newest first. Unread ones stand out; choosing
 * one marks it read and opens what it is about (`openAction`, a Server
 * Action bound to the notification).
 */
export function NotificationList({
  items,
  openAction,
}: {
  items: NotificationListItem[];
  openAction: (id: string) => () => Promise<void>;
}) {
  return (
    <ul
      className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white"
      aria-label="Notifications"
    >
      {items.map((item) => {
        const Icon = ICONS[item.type] ?? CalendarClock;
        return (
          <li key={item.id}>
            <form action={openAction(item.id)}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700",
                  !item.is_read && "bg-blue-50/60",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    item.is_read ? "text-slate-400" : "text-blue-700",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm",
                      item.is_read
                        ? "text-slate-700"
                        : "font-semibold text-slate-900",
                    )}
                  >
                    {!item.is_read && <span className="sr-only">Unread. </span>}
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">
                    {item.message}
                  </span>
                  <time
                    dateTime={item.created_at}
                    className="mt-1 block text-xs text-slate-500"
                  >
                    {formatDateTime(item.created_at)}
                  </time>
                </span>
                {!item.is_read && (
                  <span
                    aria-hidden
                    className="mt-1.5 size-2.5 shrink-0 rounded-full bg-blue-700"
                  />
                )}
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
