import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { ORDER_BUCKET_STATUSES } from "@/lib/workflow/status-buckets";
import {
  earliestOpenExpectedDate,
  formatExpectedDate,
  orderHasOverdueVendor,
} from "@/lib/workflow/fulfillment";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function FulfillmentPage() {
  const [, orders] = await Promise.all([
    requirePermission("orders.send_to_vendor"),
    listOrders([...ORDER_BUCKET_STATUSES.active]),
  ]);
  const sorted = [...orders].sort((a, b) => {
    const aLate = orderHasOverdueVendor(a.vendor_orders) ? 0 : 1;
    const bLate = orderHasOverdueVendor(b.vendor_orders) ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;
    return (earliestOpenExpectedDate(a.vendor_orders) ?? "9999").localeCompare(
      earliestOpenExpectedDate(b.vendor_orders) ?? "9999",
    );
  });

  return (
    <PageFrame>
      <PageHeader
        title="Fulfillment"
        hideTitleOnMobile
        description="Split lines across vendors, type what arrived, and watch expected dates. Overdue batches sort to the top."
      />
      {sorted.length === 0 ? (
        <EmptyState
          title="No orders ready for a vendor"
          description="QUOTE jobs stay with Sales and Accounts until payment is verified. Once an order is Active, it lands here so you can send it to a vendor, mark dispatch, and record what arrived."
        />
      ) : (
        <ul className={wellClass}>
          {sorted.map((order) => {
            const expected = formatExpectedDate(
              earliestOpenExpectedDate(order.vendor_orders),
            );
            const overdue = orderHasOverdueVendor(order.vendor_orders);
            return (
              <JobRow
                key={order.id}
                href={`/fulfillment/${order.id}`}
                title={rel(order.quotes)?.quote_number ?? "Order"}
                subtitle={rel(order.customers)?.name ?? "Customer"}
                hint={
                  overdue
                    ? `Overdue${expected ? ` · expected ${expected}` : ""}`
                    : expected
                      ? `Expected ${expected}`
                      : "Review lines to send or receive."
                }
                alert={overdue}
                status={order.status as WorkflowStatus}
              />
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
