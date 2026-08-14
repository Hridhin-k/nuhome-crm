import { ProgressBar } from "@/components/app/progress-bar";
import { timelineIndex, TIMELINE_STEPS } from "@/lib/workflow/labels";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

function stepState(
  index: number,
  current: number,
  status: WorkflowStatus,
) {
  if (current > index) return "done" as const;
  if (current === index) {
    if (status === "order_on_hold") return "blocked" as const;
    return "current" as const;
  }
  return "upcoming" as const;
}

export function OrderTimeline({
  status,
  activated = false,
}: {
  status: WorkflowStatus;
  activated?: boolean;
}) {
  const current = timelineIndex(status, activated);
  const max = TIMELINE_STEPS.length - 1;

  return (
    <div className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="text-label text-on-surface-variant">Order Timeline</p>
        <p className="text-[13px] font-semibold text-primary">
          {Math.max(current, 0) + 1} / {TIMELINE_STEPS.length}
        </p>
      </div>
      <ProgressBar
        className="mb-5"
        value={Math.max(current, 0)}
        max={max}
        accent={status === "order_on_hold" ? "cobalt" : "cerulean"}
      />
      <ol>
        {TIMELINE_STEPS.map((step, index) => {
          const state = stepState(index, current, status);
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 items-center justify-center rounded-full text-xs font-bold",
                    state === "done" && "bg-success text-on-primary",
                    state === "current" &&
                      "bg-primary text-on-primary ring-4 ring-primary/15",
                    state === "blocked" &&
                      "bg-error text-on-primary ring-4 ring-error/15",
                    state === "upcoming" &&
                      "border border-surface-variant bg-surface-container-lowest text-outline",
                  )}
                  aria-hidden
                >
                  {state === "done" ? "✓" : state === "blocked" ? "!" : ""}
                </span>
                {index < TIMELINE_STEPS.length - 1 ? (
                  <span className="mt-1 w-0.5 flex-1 bg-surface-variant" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-5">
                <p
                  className={cn(
                    "text-[15px]",
                    state === "current" && "font-semibold text-primary",
                    state === "blocked" && "font-semibold text-error",
                    state === "done" && "text-on-surface-variant",
                    state === "upcoming" && "text-outline",
                  )}
                >
                  {step.label}
                </p>
                {state === "current" ? (
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    In progress
                  </p>
                ) : null}
                {state === "blocked" ? (
                  <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-error">
                    Blocked
                  </p>
                ) : null}
                {state === "upcoming" ? (
                  <p className="mt-0.5 text-xs text-outline">Upcoming</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
