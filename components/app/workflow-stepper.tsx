import { FLOW_STAGES, flowStageIndex } from "@/lib/workflow/stages";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const COMPACT_IDS = [
  "walk_in",
  "materials",
  "accounts_review",
  "send_customer",
  "payment",
  "order_active",
  "vendor",
  "received",
  "delivery_gate",
  "deliver",
  "closed",
] as const;

export function WorkflowStepper({
  status,
  outstanding = 0,
  compact = true,
}: {
  status: WorkflowStatus;
  outstanding?: number;
  compact?: boolean;
}) {
  const currentIdx = flowStageIndex(status, outstanding);
  const stages = compact
    ? FLOW_STAGES.filter((s) =>
        (COMPACT_IDS as readonly string[]).includes(s.id),
      )
    : FLOW_STAGES;

  return (
    <nav
      aria-label="Workflow progress"
      className="overflow-x-auto rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-card"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        Process flow
      </p>
      <ol className="flex min-w-max items-center gap-1">
        {stages.map((stage, i) => {
          const stageIdx = FLOW_STAGES.findIndex((s) => s.id === stage.id);
          const isComplete = stageIdx < currentIdx;
          const isCurrent = stageIdx === currentIdx;
          const isUpcoming = stageIdx > currentIdx;

          return (
            <li key={stage.id} className="flex items-center">
              <div
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1",
                  isCurrent && "rounded-lg bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold",
                    isComplete && "bg-success text-on-primary",
                    isCurrent && "bg-primary text-on-primary ring-2 ring-primary/30",
                    isUpcoming && "bg-surface-container text-on-surface-variant",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {isComplete ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "max-w-[72px] text-center text-[10px] leading-tight font-medium",
                    isCurrent ? "text-primary" : "text-on-surface-variant",
                  )}
                >
                  {stage.shortLabel}
                </span>
              </div>
              {i < stages.length - 1 ? (
                <span
                  className={cn(
                    "mx-0.5 h-0.5 w-4 shrink-0 rounded-full",
                    isComplete ? "bg-success" : "bg-surface-variant",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
