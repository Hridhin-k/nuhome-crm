"use client";

import { useEffect } from "react";

export function ScrollToFocus({ focus }: { focus?: string }) {
  useEffect(() => {
    if (!focus) return;
    const node = document.getElementById(`vendor-${focus}`);
    node?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [focus]);
  return null;
}
