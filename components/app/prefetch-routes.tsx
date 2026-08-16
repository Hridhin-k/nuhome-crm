"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Warm the client router as soon as the shell is up. */
export function PrefetchRoutes({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const key = hrefs.join("|");

  useEffect(() => {
    const routes = key.split("|").filter(Boolean);
    for (const href of routes) {
      void router.prefetch(href, { kind: "full" } as Parameters<
        typeof router.prefetch
      >[1]);
    }
  }, [key, router]);

  return null;
}
