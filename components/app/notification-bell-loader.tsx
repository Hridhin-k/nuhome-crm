import { NotificationBell } from "@/components/app/notification-bell";
import { listNotifications } from "@/lib/api/notifications";

export async function NotificationBellLoader({ userId }: { userId: string }) {
  const notifications = await listNotifications(userId).catch(() => []);
  return <NotificationBell userId={userId} initial={notifications} />;
}
