"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SCROLL_KEY = "nuhome:fulfillment-scroll";

let originalScrollTo: typeof window.scrollTo | null = null;

/** Call from vendor action forms before submit so the page can restore position after redirect. */
export function rememberFulfillmentScroll() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  } catch {
    /* ignore quota / private mode */
  }

  // Intercept the immediate next scroll-to-top to prevent visual glitching
  if (originalScrollTo) return;
  const original = window.scrollTo;
  originalScrollTo = original;

  window.scrollTo = function (...args: any[]) {
    const isTop =
      (args.length === 2 && args[0] === 0 && args[1] === 0) ||
      (args.length === 1 && typeof args[0] === "object" && args[0].top === 0 && args[0].left === 0);
    
    if (isTop) {
      // Next.js App Router resets scroll to top on redirect. Drop this event once.
      window.scrollTo = original;
      originalScrollTo = null;
      return; 
    }
    // @ts-ignore
    original.apply(this, args);
  };
  
  // Failsafe in case server action errors out and no navigation occurs
  setTimeout(() => {
    if (originalScrollTo === original) {
      window.scrollTo = original;
      originalScrollTo = null;
    }
  }, 5000);
}

export function ScrollToFocus({ focus }: { focus?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Unpatch if navigation beat the failsafe
    if (originalScrollTo) {
      window.scrollTo = originalScrollTo;
      originalScrollTo = null;
    }

    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(SCROLL_KEY);
      sessionStorage.removeItem(SCROLL_KEY);
    } catch {
      /* ignore */
    }

    // If there's a specific vendor section to focus on, prioritize that over raw Y offset.
    if (!focus && saved != null) {
      const y = Number(saved);
      if (Number.isFinite(y)) {
        window.scrollTo({ top: y, left: 0, behavior: "instant" });
      }
      return;
    }

    if (!focus) return;
    
    const timer = setTimeout(() => {
      document
        .getElementById(`vendor-${focus}`)
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    }, 10);
    return () => clearTimeout(timer);
  }, [focus, pathname, searchParams]);

  return null;
}
