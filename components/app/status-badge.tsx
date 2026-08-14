import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_TONE } from "@/lib/workflow/labels";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const toneClass: Record<string, string> = {
  neutral: "bg-surface-variant text-on-surface-variant",
  warning: "bg-warning-container text-warning",
  success: "bg-success-container text-success",
  danger: "bg-error-container text-on-error-container",
  info: "bg-secondary-container text-on-secondary-container",
};

const toneDot: Record<string, string> = {
  neutral: "bg-outline",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-error",
  info: "bg-secondary",
};

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-auto border-0 px-2 py-1 text-xs font-semibold normal-case tracking-normal",
        toneClass[tone],
      )}
    >
      <span className={cn("size-1.5 rounded-full", toneDot[tone])} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
