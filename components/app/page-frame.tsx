import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageFrame({
  width = "list",
  className,
  children,
}: {
  width?: "list" | "detail" | "wide";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0",
        width === "detail" && "max-w-3xl pb-24 md:pb-0",
        width === "list" && "max-w-6xl",
        width === "wide" && "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const wellClass =
  "flex flex-col gap-3";

export const panelClass =
  "rounded-2xl border border-outline-variant bg-card p-4 shadow-card";

export const listRowClass =
  "block min-w-0 rounded-2xl border border-outline-variant bg-card p-4 shadow-card transition-colors hover:bg-surface-container-low/50 active:bg-surface-container-low";
