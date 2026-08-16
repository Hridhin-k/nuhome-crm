import { Badge } from "@/components/ui/badge";
import {
  STATUS_BADGE_CLASS,
  STATUS_DOT_CLASS,
  STATUS_LABELS,
} from "@/lib/workflow/labels";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: WorkflowStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "max-w-full gap-1.5 border-0 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase md:px-2 md:py-1 md:text-[11px]",
        STATUS_BADGE_CLASS[status],
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT_CLASS[status])}
        aria-hidden
      />
      <span className="min-w-0">{STATUS_LABELS[status]}</span>
    </Badge>
  );
}
