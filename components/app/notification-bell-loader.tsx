import { NotificationBell } from "@/components/app/notification-bell";
import { listNotifications } from "@/lib/api/notifications";
import { getAccessToken } from "@/lib/auth/session";

export async function NotificationBellLoader({ userId }: { userId: string }) {
  const [notifications, accessToken] = await Promise.all([
    listNotifications(userId).catch(() => []),
    getAccessToken(),
  ]);
  return (
    <NotificationBell
      userId={userId}
      initial={notifications}
      accessToken={accessToken}
    />
  );
}
