import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ProgressBar } from "@/components/app/progress-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { OrderBucketNav } from "@/components/orders/order-bucket-nav";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import {
  STATUS_LABELS,
  TIMELINE_STEPS,
  timelineIndex,
} from "@/lib/workflow/labels";
import {
  ORDER_BUCKET_ACCENT,
  orderBucket,
  statusesForOrderQuery,
} from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; bucket?: string }>;
}) {
  const { status, bucket } = await searchParams;
  const query = statusesForOrderQuery({ bucket, status });
  const [, orders] = await Promise.all([
    requireUser(),
    listOrders(query.filter),
  ]);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Open work stays here. Closed jobs are only under Closed."
      />
      <OrderBucketNav active={query.bucket === "attention" ? "open" : query.bucket} />
      {orders.length === 0 ? (
        <EmptyState
          title="No orders here"
          description="Orders appear after an approved quote is sent to the customer."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {orders.map((order) => {
            const workflowStatus = order.status as WorkflowStatus;
            const step = Math.max(timelineIndex(workflowStatus), 0);
            const bucketId = orderBucket(workflowStatus);
            return (
              <li key={order.id}>
                <AppLink
                  href={`/orders/${order.id}`}
                  className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold text-on-surface">
                      {rel(order.quotes)?.quote_number ?? "Order"}
                    </p>
                    <StatusBadge status={workflowStatus} />
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {rel(order.customers)?.name}
                  </p>
                  <ProgressBar
                    className="mt-4"
                    value={bucketId === "closed" ? TIMELINE_STEPS.length - 1 : step}
                    max={TIMELINE_STEPS.length - 1}
                    accent={ORDER_BUCKET_ACCENT[bucketId]}
                  />
                  <p className="mt-2 text-[13px] text-on-surface-variant">
                    {STATUS_LABELS[workflowStatus]}
                  </p>
                </AppLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
