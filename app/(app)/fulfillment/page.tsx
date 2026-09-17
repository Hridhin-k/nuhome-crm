import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { ListPager } from "@/components/app/list-pager";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listOrdersPage } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { orderRef } from "@/lib/orders/ref";
import { requirePermission } from "@/lib/auth/guards";
import { parsePage, pathWithQuery } from "@/lib/search";
import { ORDER_BUCKET_STATUSES } from "@/lib/workflow/status-buckets";
import {
  earliestOpenExpectedDate,
  formatExpectedDate,
  orderHasOverdueVendor,
} from "@/lib/workflow/fulfillment";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function FulfillmentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;
  const page = parsePage(pageRaw);
  const [, list] = await Promise.all([
    requirePermission("orders.send_to_vendor"),
    listOrdersPage({
      statuses: [...ORDER_BUCKET_STATUSES.active],
      page,
    }),
  ]);
  const sorted = [...list.rows].sort((a, b) => {
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
        <>
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
                title={orderRef(order)}
                subtitle={[
                  rel(order.quotes)?.quote_number,
                  rel(order.customers)?.name ?? "Customer",
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
        <ListPager
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          hrefFor={(next) =>
            pathWithQuery("/fulfillment", {
              page: next > 1 ? String(next) : undefined,
            })
          }
        />
        </>
      )}
    </PageFrame>
  );
}
