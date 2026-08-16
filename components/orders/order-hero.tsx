import { StatusBadge } from "@/components/app/status-badge";
import { formatInr } from "@/lib/format/money";
import { STATUS_LABELS } from "@/lib/workflow/labels";
import { isClosedOrderStatus } from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

export function OrderHero({
  orderNumber,
  quoteNumber,
  customerName,
  status,
  total,
  paid,
  outstanding,
  statusExplanation,
}: {
  orderNumber: string;
  quoteNumber?: string;
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
  const closed = isClosedOrderStatus(status);

  return (
    <header className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label-caps text-on-surface-variant">Order ID</p>
          <h1 className="mt-1 truncate text-headline-lg tracking-tight text-on-surface">
            {orderNumber}
          </h1>
          <p className="mt-1 truncate text-body-md text-on-surface-variant">
            {customerName}
            {quoteNumber ? ` · ${quoteNumber}` : ""}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <section className="grid grid-cols-3 divide-x divide-outline-variant/60 rounded-2xl border border-outline-variant bg-card shadow-card">
        <div className="px-3 py-3 md:px-4">
          <p className="text-label-caps text-on-surface-variant">Total</p>
          <p className="mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight text-on-surface md:text-data-tabular">
            {formatInr(total)}
          </p>
        </div>
        <div className="px-3 py-3 md:px-4">
          <p className="text-label-caps text-on-surface-variant">Paid</p>
          <p className="mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight text-success md:text-data-tabular">
            {formatInr(paid)}
          </p>
        </div>
        <div className="px-3 py-3 text-right md:px-4">
          <p className="text-label-caps text-on-surface-variant">Due</p>
          <p
            className={cn(
              "mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight md:text-data-tabular",
              outstanding > 0 ? "text-error" : "text-success",
            )}
          >
            {formatInr(outstanding)}
          </p>
        </div>
      </section>

      <p
        className={cn(
          "text-body-sm text-on-surface-variant",
          blocked && !closed && "text-on-error-container",
        )}
        role="status"
        aria-label={`Order status: ${STATUS_LABELS[status]}. ${statusExplanation}`}
      >
        {statusExplanation}
      </p>
    </header>
  );
}
