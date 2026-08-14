import { StatusBadge } from "@/components/app/status-badge";
import { formatInrExact } from "@/lib/format/money";
import { STATUS_LABELS } from "@/lib/workflow/labels";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

export function OrderHero({
  quoteNumber,
  customerName,
  status,
  total,
  paid,
  outstanding,
  statusExplanation,
}: {
  quoteNumber: string;
  customerName: string;
  status: WorkflowStatus;
  total: number;
  paid: number;
  outstanding: number;
  statusExplanation: string;
}) {
  const blocked =
    status === "order_on_hold" ||
    status === "delivery_pending_payment" ||
    (outstanding > 0 &&
      ["items_received", "delivery_pending_payment", "order_on_hold"].includes(
        status,
      ));

  return (
    <section
      className={cn(
        "rounded-xl border bg-surface-container-lowest p-5 shadow-card",
        blocked ? "border-error/30" : "border-surface-variant",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Order
          </p>
          <h1 className="mt-1 text-[24px] font-bold leading-tight text-primary">
            {quoteNumber}
          </h1>
          <p className="mt-1 text-body-lg text-on-surface">{customerName}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-surface-variant pt-4">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Order total
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {formatInrExact(total)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Paid
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-success">
            {formatInrExact(paid)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Outstanding
          </dt>
          <dd
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              outstanding > 0 ? "text-error" : "text-success",
            )}
          >
            {formatInrExact(outstanding)}
          </dd>
        </div>
      </dl>

      <div
        className={cn(
          "mt-4 rounded-lg px-4 py-3 text-sm",
          blocked
            ? "bg-error-container/50 text-on-error-container"
            : "bg-surface-container text-on-surface-variant",
        )}
        role="status"
        aria-label={`Order status: ${STATUS_LABELS[status]}. ${statusExplanation}`}
      >
        <span className="font-semibold text-on-surface">
          {STATUS_LABELS[status]}
        </span>
        <span className="mx-2 text-outline" aria-hidden>
          ·
        </span>
        {statusExplanation}
      </div>
    </section>
  );
}
