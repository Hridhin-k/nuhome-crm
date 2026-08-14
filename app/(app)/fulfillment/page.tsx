import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { ORDER_BUCKET_STATUSES } from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

const STEPS = [
  { n: 1, label: "Send to vendor" },
  { n: 2, label: "Mark dispatched" },
  { n: 3, label: "Record receipt" },
];

export default async function FulfillmentPage() {
  const [, orders] = await Promise.all([
    requirePermission("orders.send_to_vendor"),
    listOrders([...ORDER_BUCKET_STATUSES.active]),
  ]);

  return (
    <div>
      <PageHeader
        title="Fulfillment"
        description="Your vendor queue. Orders arrive here only after Accounts verifies payment."
      />
      <ol className="mb-5 flex gap-2 text-sm">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-surface-variant bg-surface-container-lowest px-3 py-2.5 text-on-surface-variant"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-surface-container text-xs font-bold">
              {step.n}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
      {orders.length === 0 ? (
        <EmptyState
          title="No orders ready for a vendor"
          description="QUOTE jobs stay with Sales and Accounts until payment is verified. Once an order is Active, it lands here so you can send it to a vendor, mark dispatch, and record what arrived."
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
