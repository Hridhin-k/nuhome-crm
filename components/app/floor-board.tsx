import { AppLink } from "@/components/app/app-link";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/workflow/labels";
import { formatIstDateTime } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { StatusCensus } from "@/lib/api/dashboard";
import type { WorkflowStatus } from "@/lib/workflow/types";

export function FloorBoard({
  census,
  asOf,
  overdue,
  pendingPayments,
  pendingApprovals,
  open,
  customers,
  delivered,
}: {
  census: StatusCensus[];
  asOf: string;
  overdue: number;
  pendingPayments: number;
  pendingApprovals: number;
  open: number;
  customers: number;
  delivered: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-card shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant px-4 py-4">
        <div className="min-w-0">
          <p className="text-label-caps text-on-surface-variant">Floor</p>
          <h2 className="mt-0.5 text-subheading text-on-surface">
            Every job on the floor
          </h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            As of {formatIstDateTime(asOf)} IST
          </p>
        </div>
        <dl className="flex min-w-0 gap-3 text-right">
          <div>
            <dt className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
              In play
            </dt>
            <dd className="text-headline-sm text-on-surface">{open}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
              Overdue
            </dt>
            <dd className="text-headline-sm text-error">{overdue}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
              Cust.
            </dt>
            <dd className="text-headline-sm text-secondary">{customers}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium tracking-wide text-on-surface-variant uppercase">
              Done
            </dt>
            <dd className="text-headline-sm text-success">{delivered}</dd>
          </div>
        </dl>
      </div>
      <ul className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4">
        {census.map((cell) => (
          <li key={cell.status}>
            <FloorTile cell={cell} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-outline-variant px-3 py-3">
        <AttentionChip
          href="/fulfillment"
          label="Vendor overdue"
          count={overdue}
          alert
        />
        <AttentionChip
          href="/payments"
          label="Pay to verify"
          count={pendingPayments}
        />
        <AttentionChip
          href="/approvals"
          label="Approvals"
          count={pendingApprovals}
        />
      </div>
    </section>
  );
}

function FloorTile({ cell }: { cell: StatusCensus }) {
  const muted = cell.count === 0;
  return (
    <AppLink
      href={cell.href}
      className={cn(
        "flex min-h-[4.25rem] flex-col justify-between rounded-xl px-3 py-2.5 transition-opacity",
        STATUS_BADGE_CLASS[cell.status as WorkflowStatus],
        muted && "opacity-45",
      )}
    >
      <span className="text-[10px] font-bold tracking-wide uppercase md:text-[11px]">
        {STATUS_LABELS[cell.status]}
      </span>
      <span className="text-headline-sm tabular-nums">{cell.count}</span>
    </AppLink>
  );
}

function AttentionChip({
  href,
  label,
  count,
  alert,
}: {
  href: string;
  label: string;
  count: number;
  alert?: boolean;
}) {
  return (
    <AppLink
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-body-sm",
        alert && count > 0
          ? "border-error bg-error-container text-error"
          : "border-outline-variant bg-surface-container-low text-on-surface",
      )}
    >
      <span>{label}</span>
      <span className="text-data-tabular">{count}</span>
    </AppLink>
  );
}
