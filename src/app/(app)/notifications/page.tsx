import { Bell } from "lucide-react";
import type { Metadata } from "next";

import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationList } from "@/components/notifications/notification-list";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requireUser } from "@/lib/auth/current-user";
import {
  markAllNotificationsRead,
  openNotification,
} from "@/lib/notifications/actions";
import {
  countUnreadNotifications,
  listNotifications,
  NOTIFICATIONS_PAGE_SIZE,
} from "@/lib/notifications/queries";

export const metadata: Metadata = { title: "Notifications" };

/**
 * In-app notifications: reminders written by the nightly job (overdue
 * returns; warranties ending soon for admins). Each user sees only their own.
 */
export default async function NotificationsPage({
  searchParams,
}: PageProps<"/notifications">) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const parsedPage = Number.parseInt(String(pageParam ?? "1"), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [{ rows, total }, unread] = await Promise.all([
    listNotifications(user.id, page),
    countUnreadNotifications(user.id),
  ]);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Reminders about your assets and, for admins, warranties ending soon."
        actions={
          unread > 0 && <MarkAllReadButton action={markAllNotificationsRead} />
        }
      />

      {total === null || rows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Reminders appear here, for example when an asset you are using is overdue for return."
        />
      ) : (
        <>
          <NotificationList
            items={rows}
            openAction={(id) => openNotification.bind(null, id)}
          />
          <Pagination
            page={page}
            pageSize={NOTIFICATIONS_PAGE_SIZE}
            total={total}
            hrefFor={(target) =>
              target > 1 ? `/notifications?page=${target}` : "/notifications"
            }
            label="notifications"
          />
        </>
      )}
    </>
  );
}
