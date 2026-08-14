import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ProgressBar } from "@/components/app/progress-bar";
import { StatusBadge } from "@/components/app/status-badge";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import {
  STATUS_LABELS,
  TIMELINE_STEPS,
  timelineIndex,
} from "@/lib/workflow/labels";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ status }] = await Promise.all([searchParams, requireUser()]);
  const orders = await listOrders(
    status ? (status as WorkflowStatus) : undefined,
  );

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Follow the job from payment to close."
      />
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
                    value={step}
                    max={TIMELINE_STEPS.length - 1}
                    accent={
                      workflowStatus === "order_on_hold" ? "violet" : "cobalt"
                    }
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
