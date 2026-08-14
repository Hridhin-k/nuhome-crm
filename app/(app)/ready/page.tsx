import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function ReadyPage() {
  const [, orders] = await Promise.all([
    requirePermission("deliveries.complete"),
    listOrders("delivery_unlocked"),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Ready for delivery"
        hideTitleOnMobile
        description="Full payment verified. Complete handover with the customer."
      />
      {orders.length === 0 ? (
        <EmptyState
          title="No deliveries ready"
          description="Unlocked orders appear here after full payment is verified."
        />
      ) : (
        <ul className={wellClass}>
          {orders.map((order) => (
            <JobRow
              key={order.id}
              href={`/orders/${order.id}`}
              title={rel(order.quotes)?.quote_number ?? "Order"}
              subtitle={rel(order.customers)?.name ?? undefined}
              hint="Complete handover with the customer."
              status={order.status as WorkflowStatus}
            />
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
