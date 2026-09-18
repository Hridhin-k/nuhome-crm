"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  bindRealtimeAuth,
  createBrowserSupabaseClient,
} from "@/lib/supabase/client";

const DEBOUNCE_MS = 1800;
const MUTATION_SUPPRESS_MS = 2200;

function tablesForPath(pathname: string): string[] {
  if (
    pathname === "/home" ||
    pathname.startsWith("/reports") ||
    pathname === "/"
  ) {
    return [
      "notifications",
      "quotes",
      "orders",
      "payments",
      "vendor_orders",
      "deliveries",
      "customers",
    ];
  }
  if (pathname.startsWith("/customers")) {
    return ["notifications", "customers", "orders"];
  }
  if (
    pathname.startsWith("/quotes") ||
    pathname.startsWith("/approvals") ||
    pathname.startsWith("/walk-in")
  ) {
    return ["notifications", "quotes", "orders"];
  }
  if (pathname.startsWith("/fulfillment")) {
    return ["notifications", "orders", "vendor_orders"];
  }
  if (pathname.startsWith("/payments")) {
    return ["notifications", "payments", "orders"];
  }
  if (pathname.startsWith("/ready") || pathname.startsWith("/orders")) {
    return ["notifications", "orders", "payments", "deliveries"];
  }
  return ["notifications"];
}

export function LiveRefresh({
  userId,
  accessToken,
}: {
  userId: string;
  accessToken: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/home";
  const tables = useMemo(() => tablesForPath(pathname), [pathname]);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let queued = false;
    let hiddenAt: number | null = null;
    let disposed = false;
    let suppressUntil = 0;

    function flush() {
      if (Date.now() < suppressUntil) {
        const wait = suppressUntil - Date.now() + 50;
        timer = setTimeout(flush, wait);
        return;
      }
      queued = false;
      router.refresh();
    }

    function schedule() {
      queued = true;
      if (document.visibilityState !== "visible") {
        return;
      }
      if (timer) {
        clearTimeout(timer);
      }
      const delay =
        Date.now() < suppressUntil
          ? Math.max(DEBOUNCE_MS, suppressUntil - Date.now() + 50)
          : DEBOUNCE_MS;
      timer = setTimeout(flush, delay);
    }

    function onActionPending() {
      suppressUntil = Date.now() + MUTATION_SUPPRESS_MS;
      if (timer) {
        clearTimeout(timer);
        timer = setTimeout(flush, MUTATION_SUPPRESS_MS + 50);
      }
    }

    function onVisible() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (queued) {
        flush();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > 2000 && Date.now() >= suppressUntil) {
        router.refresh();
      }
      hiddenAt = null;
    }

    const channels: ReturnType<typeof supabase.channel>[] = [];
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function listen(name: string, tableList: string[], retryOnError: boolean) {
      const next = supabase.channel(name);
      for (const table of tableList) {
        next.on(
          "postgres_changes",
          table === "notifications"
            ? {
                event: "*",
                schema: "public",
                table,
                filter: `user_id=eq.${userId}`,
              }
            : { event: "*", schema: "public", table },
          schedule,
        );
      }
      next.subscribe((status) => {
        if (disposed || !retryOnError) {
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (retryTimer) {
            clearTimeout(retryTimer);
          }
          retryTimer = setTimeout(() => {
            if (!disposed) {
              void connect();
            }
          }, 2000);
        }
      });
      channels.push(next);
    }

    async function connect() {
      await bindRealtimeAuth(tokenRef.current);
      if (disposed) {
        return;
      }
      while (channels.length > 0) {
        const existing = channels.pop();
        if (existing) {
          void supabase.removeChannel(existing);
        }
      }
      listen(`live:${userId}:${tables.join(",")}`, tables, true);
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("nuhome:action-pending", onActionPending);
    void connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("nuhome:action-pending", onActionPending);
      if (timer) {
        clearTimeout(timer);
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId, accessToken, router, tables]);

  return null;
}
