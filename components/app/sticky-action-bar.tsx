import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:static md:mt-4 md:rounded-2xl md:border md:shadow-card",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-2">{children}</div>
    </div>
  );
}
