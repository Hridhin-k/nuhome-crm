import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { OrderBucketNav } from "@/components/orders/order-bucket-nav";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";
import { STATUS_NEXT_LINE } from "@/lib/workflow/labels";
import { statusesForOrderQuery } from "@/lib/workflow/status-buckets";
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
    <PageFrame>
      <PageHeader
        title="Orders"
        hideTitleOnMobile
        description="Open work stays here. Closed jobs are only under Closed."
      />
      <OrderBucketNav active={query.bucket === "attention" ? "open" : query.bucket} />
      {orders.length === 0 ? (
        <EmptyState
          title="No orders here"
          description="Orders appear after an approved quote is sent to the customer."
        />
      ) : (
        <ul className={wellClass}>
          {orders.map((order) => {
            const workflowStatus = order.status as WorkflowStatus;
            const quote = rel(order.quotes);
            const version = rel(
              (quote as { quote_versions?: unknown } | null)?.quote_versions,
            ) as { total?: number | string } | null;
            const total = Number(version?.total ?? 0);
            return (
              <JobRow
                key={order.id}
                href={`/orders/${order.id}`}
                title={quote?.quote_number ?? "Order"}
                subtitle={rel(order.customers)?.name ?? undefined}
                amount={total ? formatInr(total) : undefined}
                hint={STATUS_NEXT_LINE[workflowStatus]}
                status={workflowStatus}
              />
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
