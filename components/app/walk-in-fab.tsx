"use client";

import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/app/app-link";

export function WalkInFab() {
  const pathname = usePathname();
  if (pathname.startsWith("/walk-in")) return null;
  if (/^\/(quotes|orders|approvals|fulfillment)\/[^/]+/.test(pathname)) {
    return null;
  }

  return (
    <AppLink
      href="/walk-in"
      aria-label="Customer walk-in"
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex size-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0px_4px_12px_rgba(0,0,0,0.15)] transition-transform active:scale-95 md:hidden"
    >
      <Plus className="size-6" strokeWidth={2.25} aria-hidden />
    </AppLink>
  );
}
