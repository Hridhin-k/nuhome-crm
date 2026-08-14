import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { WorkflowStepper } from "@/components/app/workflow-stepper";
import { StatusBadge } from "@/components/app/status-badge";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function FulfillmentPage() {
  await requirePermission("orders.send_to_vendor");
  const orders = await listOrders([
    "order_active",
    "sent_to_vendor",
    "vendor_dispatched",
  ]);

  return (
    <div>
      <PageHeader
        title="Fulfillment"
        description="Send to vendor → dispatch → receive items."
      />
      <WorkflowStepper status="order_active" />
      {orders.length === 0 ? (
        <EmptyState
          title="Nothing to fulfill"
          description="Activated orders will appear here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <AppLink
                href={`/fulfillment/${order.id}`}
                className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card"
              >
                <div className="flex justify-between gap-3">
                  <p className="font-medium">
                    {rel(order.quotes)?.quote_number}
                  </p>
                  <StatusBadge status={order.status as WorkflowStatus} />
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {rel(order.customers)?.name}
                </p>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
