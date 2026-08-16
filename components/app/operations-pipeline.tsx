import { AppLink } from "@/components/app/app-link";
import { accentText, ProgressBar } from "@/components/app/progress-bar";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/lib/api/dashboard";

export function OperationsPipeline({
  stages,
  open,
  customers,
  delivered,
}: {
  stages: PipelineStage[];
  open: number;
  customers: number;
  delivered: number;
}) {
  const peak = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-outline-variant bg-card shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant px-4 py-4">
        <div className="min-w-0">
          <p className="text-label-caps text-on-surface-variant">
            Operations
          </p>
          <h2 className="mt-0.5 text-subheading text-on-surface">
            What is moving
          </h2>
        </div>
        <dl className="flex min-w-0 gap-3 text-right">
          <div>
            <dt className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
              Open
            </dt>
            <dd className="text-[16px] font-semibold text-on-surface">{open}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
              Cust.
            </dt>
            <dd className="text-[16px] font-semibold text-secondary">
              {customers}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
              Done
            </dt>
            <dd className="text-[16px] font-semibold text-success">
              {delivered}
            </dd>
          </div>
        </dl>
      </div>
      <ul className="space-y-3 p-3">
        {stages.map((stage) => (
          <li key={stage.label}>
            <AppLink href={stage.href} className="block">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-body-md font-medium text-on-surface">
                  {stage.label}
                </span>
                <span
                  className={cn(
                    "text-body-md font-semibold",
                    stage.count > 0
                      ? accentText[stage.accent]
                      : "text-on-surface-variant",
                  )}
                >
                  {stage.count}
                </span>
              </div>
              <ProgressBar
                value={stage.count}
                max={peak}
                accent={stage.accent}
              />
            </AppLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
