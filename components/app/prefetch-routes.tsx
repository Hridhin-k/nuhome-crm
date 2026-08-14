"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Warm the client router as soon as the shell is up. */
export function PrefetchRoutes({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const key = hrefs.join("|");

  useEffect(() => {
    let cancelled = false;
    const routes = key.split("|").filter(Boolean);

    function warm() {
      if (cancelled) return;
      for (const href of routes) {
        void router.prefetch(href);
      }
    }

    const idle =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(warm, { timeout: 500 })
        : window.setTimeout(warm, 0);

    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idle as number);
      } else {
        clearTimeout(idle as number);
      }
    };
  }, [key, router]);

  return null;
}
