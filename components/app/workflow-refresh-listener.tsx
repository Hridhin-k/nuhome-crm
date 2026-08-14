"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const REFRESH_DEBOUNCE_MS = 400;

const WORKFLOW_TABLES = ["orders", "payments", "quotes"] as const;

/** Re-fetch server-rendered workflow pages when peer roles mutate shared data. */
export function WorkflowRefreshListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    function scheduleRefresh() {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => {
        router.refresh();
        timeout = undefined;
      }, REFRESH_DEBOUNCE_MS);
    }

    let channel = supabase.channel("workflow-refresh");

    for (const table of WORKFLOW_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }

    channel.subscribe();

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
