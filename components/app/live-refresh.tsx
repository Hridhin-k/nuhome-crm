"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  bindRealtimeAuth,
  createBrowserSupabaseClient,
} from "@/lib/supabase/client";

const DEBOUNCE_MS = 1800;
const MUTATION_SUPPRESS_MS = 2200;
/** Inside auth-js's 90s expiry margin, so the server hands back a fresh token. */
const TOKEN_REFRESH_LEAD_MS = 60_000;
const TOKEN_RETRY_MS = 15_000;

/** Milliseconds since epoch when the JWT expires, or null if unreadable. */
function tokenExpiresAt(token: string | null): number | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

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
      "stock_purchases",
    ];
  }
  if (pathname.startsWith("/stock")) {
    return ["notifications", "stock_purchases", "stock_movements"];
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
    let tokenTimer: ReturnType<typeof setTimeout> | null = null;
    let lastTokenRefresh = 0;
    let subscribedOnce = false;
    const expiresAt = tokenExpiresAt(accessToken);

    // The socket keeps the JWT it joined with; a refresh re-renders the layout
    // with a new token from the session cookie, which re-runs this effect.
    function refreshToken() {
      if (Date.now() - lastTokenRefresh < TOKEN_RETRY_MS) return;
      lastTokenRefresh = Date.now();
      router.refresh();
    }

    if (expiresAt) {
      tokenTimer = setTimeout(
        refreshToken,
        Math.max(expiresAt - Date.now() - TOKEN_REFRESH_LEAD_MS, 1000),
      );
    }

    function onOnline() {
      schedule();
    }

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
        if (status === "SUBSCRIBED") {
          if (subscribedOnce) {
            schedule();
          }
          subscribedOnce = true;
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (expiresAt && expiresAt - Date.now() < TOKEN_REFRESH_LEAD_MS) {
            refreshToken();
            return;
          }
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
      await bindRealtimeAuth(accessToken);
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
    window.addEventListener("online", onOnline);
    void connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("nuhome:action-pending", onActionPending);
      window.removeEventListener("online", onOnline);
      if (timer) {
        clearTimeout(timer);
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (tokenTimer) {
        clearTimeout(tokenTimer);
      }
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [userId, accessToken, router, tables]);

  return null;
}
