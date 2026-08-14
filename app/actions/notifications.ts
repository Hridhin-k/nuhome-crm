"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/api/db";
import { requireUser } from "@/lib/auth/guards";

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireUser();
  const db = await getDb();
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    return { error: "Could not mark notification as read" };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  const db = await getDb();
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    return { error: "Could not mark notifications as read" };
  }

  revalidatePath("/", "layout");
  return {};
}
