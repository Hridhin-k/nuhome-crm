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
    <section className="flex flex-col overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-surface-variant bg-surface p-4">
        <div>
          <p className="text-label-md text-on-surface-variant uppercase">
            Operations
          </p>
          <h2 className="text-headline-sm mt-1 text-on-surface">
            What is moving
          </h2>
        </div>
        <dl className="flex gap-6 text-right">
          <div>
            <dt className="text-label-md text-on-surface-variant">Open work</dt>
            <dd className="text-headline-sm text-on-surface">{open}</dd>
          </div>
          <div>
            <dt className="text-label-md text-on-surface-variant">Customers</dt>
            <dd className="text-headline-sm text-secondary">{customers}</dd>
          </div>
          <div>
            <dt className="text-label-md text-on-surface-variant">Delivered</dt>
            <dd className="text-headline-sm text-success">{delivered}</dd>
          </div>
        </dl>
      </div>
      <ul className="space-y-4 p-4">
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
