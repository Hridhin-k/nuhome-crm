import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
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
    <div>
      <PageHeader
        title="Ready for delivery"
        description="Full payment verified. Complete handover with the customer."
      />
      {orders.length === 0 ? (
        <EmptyState
          title="No deliveries ready"
          description="Unlocked orders appear here after full payment is verified."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <AppLink
                href={`/orders/${order.id}`}
                className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-card transition-colors hover:bg-surface-container-low"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{rel(order.quotes)?.quote_number}</p>
                    <p className="text-sm text-on-surface-variant">{rel(order.customers)?.name}</p>
                  </div>
                  <StatusBadge status={order.status as WorkflowStatus} />
                </div>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
