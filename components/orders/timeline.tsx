import { ProgressBar } from "@/components/app/progress-bar";
import { timelineIndex, TIMELINE_STEPS } from "@/lib/workflow/labels";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

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
          const done = current > index;
          const here = current === index;
          return (
            <li key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "mt-0.5 size-2.5 rounded-full",
                    here && "bg-primary ring-4 ring-surface-container-lowest",
                    done && "bg-outline",
                    !here && !done && "bg-surface-variant",
                  )}
                />
                {index < TIMELINE_STEPS.length - 1 ? (
                  <span
                    className={cn(
                      "w-0.5 flex-1",
                      done || here ? "bg-surface-variant" : "bg-surface-variant",
                    )}
                  />
                ) : null}
              </div>
              <p
                className={cn(
                  "pb-5 text-[15px]",
                  here && "font-semibold text-primary",
                  done && "text-on-surface-variant",
                  !here && !done && "text-outline",
                )}
              >
                {step.label}
                {here ? (
                  <span className="ml-2 text-[12px] font-bold tracking-wide text-primary uppercase">
                    Now
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
