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
        "h-auto border-0 px-2 py-1 text-xs font-semibold normal-case tracking-normal",
        STATUS_BADGE_CLASS[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASS[status])} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
