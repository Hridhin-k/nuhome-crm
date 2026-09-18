"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Warm primary nav routes after idle — avoid competing with first interactions. */
export function PrefetchRoutes({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const key = hrefs.join("|");

  useEffect(() => {
    const routes = key.split("|").filter(Boolean).slice(0, 6);
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function run() {
      for (const href of routes) {
        void router.prefetch(href);
      }
    }

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(run, 1200);
    }

    return () => {
      if (idleId !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [key, router]);

  return null;
}
