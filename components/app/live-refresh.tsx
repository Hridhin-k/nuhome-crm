"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  bindRealtimeAuth,
  createBrowserSupabaseClient,
} from "@/lib/supabase/client";

const CORE_TABLES = ["notifications", "quotes", "orders", "payments"] as const;
const EXTRA_TABLES = ["vendor_orders", "deliveries", "customers"] as const;

const DEBOUNCE_MS = 400;

export function LiveRefresh({
  userId,
  accessToken,
}: {
  userId: string;
  accessToken: string | null;
}) {
  const router = useRouter();
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let queued = false;
    let hiddenAt: number | null = null;
    let disposed = false;

    function flush() {
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
      timer = setTimeout(flush, DEBOUNCE_MS);
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
      if (hiddenAt && Date.now() - hiddenAt > 2000) {
        router.refresh();
      }
      hiddenAt = null;
    }

    const channels: ReturnType<typeof supabase.channel>[] = [];
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function listen(
      name: string,
      tables: readonly string[],
      retryOnError: boolean,
    ) {
      const next = supabase.channel(name);
      for (const table of tables) {
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

      listen(`live:${userId}`, CORE_TABLES, true);
      listen(`live-extra:${userId}`, EXTRA_TABLES, false);
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    void connect();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
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
  }, [userId, accessToken, router]);

  return null;
}
