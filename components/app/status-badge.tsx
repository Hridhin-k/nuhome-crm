import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/workflow/labels";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "max-w-full border-0 px-2 py-1 text-[11px] font-bold tracking-wide uppercase",
        STATUS_BADGE_CLASS[status],
      )}
    >
      <span className="min-w-0">{STATUS_LABELS[status]}</span>
    </Badge>
  );
}
