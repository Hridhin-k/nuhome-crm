import { cn } from "@/lib/utils";

export type Accent = "cobalt" | "violet" | "forest" | "cerulean";

export const accentText: Record<Accent, string> = {
  cobalt: "text-error",
  violet: "text-secondary",
  forest: "text-success",
  cerulean: "text-primary",
};

export const accentFill: Record<Accent, string> = {
  cobalt: "bg-error",
  violet: "bg-secondary",
  forest: "bg-success",
  cerulean: "bg-primary",
};

export const accentWash: Record<Accent, string> = {
  cobalt: "bg-error/10",
  violet: "bg-secondary/10",
  forest: "bg-success/10",
  cerulean: "bg-primary/10",
};

export const accentLabel: Record<Accent, string> = {
  cobalt: "Action Needed",
  violet: "Pending",
  forest: "Ready",
  cerulean: "In Progress",
};

export function ProgressBar({
  value,
  max,
  accent = "cerulean",
  className,
}: {
  value: number;
  max: number;
  accent?: Accent;
  className?: string;
}) {
  const pct =
    max <= 0 ? 0 : Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-surface-variant",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full",
          value > 0 ? accentFill[accent] : "bg-surface-variant",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
