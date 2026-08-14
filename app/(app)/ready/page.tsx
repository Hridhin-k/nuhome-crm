import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { WorkflowStepper } from "@/components/app/workflow-stepper";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";

export default async function ReadyPage() {
  await requirePermission("deliveries.complete");
  const orders = await listOrders("delivery_unlocked");

  return (
    <div>
      <PageHeader
        title="Ready for delivery"
        description="Full payment verified. Complete handover with the customer."
      />
      <WorkflowStepper status="delivery_unlocked" />
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
                <p className="font-medium">{rel(order.quotes)?.quote_number}</p>
                <p className="text-sm text-on-surface-variant">{rel(order.customers)?.name}</p>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
