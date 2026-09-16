import { panelClass } from "@/components/app/page-frame";
import { jobStageLabel, jobTracks, type JobTrackState } from "@/lib/workflow/job-stage";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const STATE_CLASS: Record<JobTrackState, string> = {
  idle: "bg-surface-container-high text-on-surface-variant",
  current: "bg-[#1e1b4b] text-white",
  blocked: "bg-[#8b1515] text-white",
  done: "bg-[#0f3d24] text-white",
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
          <li key={track.id} className="min-w-0">
            <p
              className={cn(
                "truncate rounded-lg px-1.5 py-2 text-center text-[11px] font-bold uppercase tracking-wide",
                STATE_CLASS[track.state],
              )}
            >
              {track.label}
            </p>
          </li>
        ))}
      </ol>
      <ul className="mt-3 space-y-1.5 text-sm text-on-surface-variant">
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
