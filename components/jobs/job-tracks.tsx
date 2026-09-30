import { AlertTriangle, Check } from "lucide-react";
import { panelClass } from "@/components/app/page-frame";
import { jobStageLabel, jobTracks, type JobTrackState } from "@/lib/workflow/job-stage";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const STATE_CLASS: Record<JobTrackState, string> = {
  idle: "bg-surface-container text-on-surface-variant",
  current: "bg-primary text-on-primary",
  blocked: "bg-error text-on-error",
  done: "bg-success-container text-success",
};

const STATE_LABEL: Record<JobTrackState, string> = {
  idle: "not started",
  current: "in progress",
  blocked: "blocked",
  done: "done",
};

export function JobTracks({
  status,
  outstanding = 0,
  paid = 0,
  hasPendingPayment = false,
  hasUnsent = false,
  creditApproved = false,
}: {
  status: WorkflowStatus;
  outstanding?: number;
  paid?: number;
  hasPendingPayment?: boolean;
  hasUnsent?: boolean;
  creditApproved?: boolean;
}) {
  const tracks = jobTracks({
    status,
    outstanding,
    paid,
    hasPendingPayment,
    hasUnsent,
    creditApproved,
  });
  const stage = jobStageLabel(status);

  return (
    <section className={panelClass}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-subheading text-on-surface">This job</h2>
        <p className="text-label-caps text-on-surface-variant">{stage}</p>
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-1.5">
        {tracks.map((track) => (
          <li
            key={track.id}
            className="min-w-0"
            aria-current={track.state === "current" ? "step" : undefined}
          >
            <p
              className={cn(
                "flex h-9 items-center justify-center gap-1 rounded-lg px-1.5 text-label-caps uppercase",
                STATE_CLASS[track.state],
              )}
            >
              {track.state === "done" ? (
                <Check className="size-3.5 shrink-0" aria-hidden />
              ) : null}
              {track.state === "blocked" ? (
                <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              ) : null}
              <span className="truncate">{track.label}</span>
              <span className="sr-only">, {STATE_LABEL[track.state]}</span>
            </p>
          </li>
        ))}
      </ol>
      <ul className="mt-3 space-y-1.5 text-body-sm text-on-surface-variant">
        {tracks
          .filter((track) => track.state === "current" || track.state === "blocked")
          .map((track) => (
            <li key={track.id}>
              <span className="font-medium text-on-surface">{track.label}.</span>{" "}
              {track.detail}
            </li>
          ))}
      </ul>
    </section>
  );
}
