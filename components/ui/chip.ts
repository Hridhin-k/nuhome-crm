import { cn } from "@/lib/utils";

/** Pill used for filters, category pickers, and either/or toggles. */
export function chipVariants({
  selected = false,
  size = "default",
}: { selected?: boolean; size?: "default" | "sm" } = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-1 rounded-full border whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-95",
    size === "sm" ? "h-8 px-3 text-body-sm font-medium" : "h-9 px-4 text-subheading",
    selected
      ? "border-primary bg-primary text-on-primary"
      : "border-outline-variant bg-card text-on-surface hover:bg-surface-container-low",
  );
}
