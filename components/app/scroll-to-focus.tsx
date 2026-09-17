"use client";

import { useLayoutEffect } from "react";

const SCROLL_KEY = "nuhome:fulfillment-scroll";

/** Call from vendor action forms before submit so the page can restore position after redirect. */
export function rememberFulfillmentScroll() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  } catch {
    /* ignore quota / private mode */
  }
}

export function ScrollToFocus({ focus }: { focus?: string }) {
  useLayoutEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(SCROLL_KEY);
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* ignore */
    }

    if (saved != null) {
      const y = Number(saved);
      if (Number.isFinite(y)) {
        window.scrollTo({ top: y, left: 0, behavior: "instant" });
        return;
      }
    }

    if (!focus) return;
    document
      .getElementById(`vendor-${focus}`)
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [focus]);

  return null;
}
