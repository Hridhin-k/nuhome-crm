"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { AppLink } from "@/components/app/app-link";
import {
  notificationHref,
  type AppNotification,
} from "@/lib/notifications/types";
import {
  bindRealtimeAuth,
  createBrowserSupabaseClient,
} from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (sameDay) {
    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function mapRow(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    body: row.body ? String(row.body) : null,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
    read_at: row.read_at ? String(row.read_at) : null,
    created_at: String(row.created_at),
  };
}

export function NotificationBellFallback() {
  return (
    <span
      className="inline-flex size-10 items-center justify-center rounded-md text-white/75"
      aria-hidden
    >
      <Bell className="size-5" />
    </span>
  );
}

export function NotificationBell({
  userId,
  initial,
  accessToken,
}: {
  userId: string;
  initial: AppNotification[];
  accessToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();

  const unreadCount = useMemo(
    () => items.filter((item) => !item.read_at).length,
    [items],
  );

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      await bindRealtimeAuth(accessToken);
      if (cancelled) {
        return;
      }
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const next = mapRow(payload.new as Record<string, unknown>);
            setItems((current) => [
              next,
              ...current.filter((item) => item.id !== next.id),
            ]);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const next = mapRow(payload.new as Record<string, unknown>);
            setItems((current) =>
              current.map((item) => (item.id === next.id ? next : item)),
            );
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId, accessToken]);

  function markRead(id: string) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, read_at: item.read_at ?? new Date().toISOString() }
          : item,
      ),
    );
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  }

  function markAllRead() {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({ ...item, read_at: item.read_at ?? now })),
    );
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="relative inline-flex size-10 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute top-1.5 right-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </SheetTrigger>
      <SheetContent placement="form" size="md" className="gap-0 p-0">
        <SheetHeader className="border-b border-surface-variant px-5 py-4">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "You're all caught up"}
              </SheetDescription>
            </div>
            {unreadCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={markAllRead}
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        </SheetHeader>

        <ul className="max-h-[min(70dvh,640px)] overflow-y-auto overscroll-contain">
          {items.length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-on-surface-variant">
              No notifications yet.
            </li>
          ) : (
            items.map((item) => {
              const href = notificationHref(item);
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-on-surface">{item.title}</p>
                    <time
                      className="shrink-0 text-xs text-on-surface-variant"
                      dateTime={item.created_at}
                    >
                      {formatWhen(item.created_at)}
                    </time>
                  </div>
                  {item.body ? (
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {item.body}
                    </p>
                  ) : null}
                </>
              );

              return (
                <li
                  key={item.id}
                  className={cn(
                    "border-b border-surface-variant last:border-b-0",
                    !item.read_at && "bg-primary/5",
                  )}
                >
                  {href ? (
                    <AppLink
                      href={href}
                      className="block px-5 py-4 transition-colors hover:bg-surface-container"
                      onClick={() => {
                        markRead(item.id);
                        setOpen(false);
                      }}
                    >
                      {content}
                    </AppLink>
                  ) : (
                    <button
                      type="button"
                      className="block w-full px-5 py-4 text-left transition-colors hover:bg-surface-container"
                      onClick={() => markRead(item.id)}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
