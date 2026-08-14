import { getDb, throwQuery } from "@/lib/api/db";
import type { AppNotification } from "@/lib/notifications/types";

function mapNotification(row: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: unknown;
  read_at: string | null;
  created_at: string;
}): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

export async function listNotifications(userId: string, limit = 30) {
  const db = await getDb();
  const rows = await throwQuery(
    db
      .from("notifications")
      .select("id, type, title, body, payload, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    "Failed to load notifications",
  );
  return rows.map(mapNotification);
}

export type { AppNotification } from "@/lib/notifications/types";
export { notificationHref } from "@/lib/notifications/types";
