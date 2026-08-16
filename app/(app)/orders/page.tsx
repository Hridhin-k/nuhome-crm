import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { ListSearchForm } from "@/components/app/list-search-form";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { OrderBucketNav } from "@/components/orders/order-bucket-nav";
import { listProfiles } from "@/lib/api/catalog";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";
import { inDateRange, matchesSearch, parseYmd } from "@/lib/search";
import { STATUS_NEXT_LINE } from "@/lib/workflow/labels";
import { statusesForOrderQuery } from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    bucket?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { status, bucket, q, from: fromRaw, to: toRaw } = await searchParams;
  const from = parseYmd(fromRaw) ?? undefined;
  const to = parseYmd(toRaw) ?? undefined;
  const query = statusesForOrderQuery({ bucket, status });
  const extra = { q, from, to };
  const [, orders, profiles] = await Promise.all([
    requireUser(),
    listOrders(query.filter),
    listProfiles(),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));
  const visible = orders.filter((order) => {
    const quote = rel(order.quotes);
    const customer = rel(order.customers);
    return (
      matchesSearch(
        [
          quote?.quote_number,
          customer?.name,
          customer?.phone,
          names.get(order.assigned_sales_id ?? ""),
        ],
        q,
      ) && inDateRange(order.updated_at, from, to)
    );
  });

  return (
    <PageFrame>
      <PageHeader
        title="Orders"
        hideTitleOnMobile
        description="Search by quote number, phone, or date. Floor book is shared across sales."
      />
      <ListSearchForm
        action="/orders"
        q={q}
        from={from}
        to={to}
        showDates
        placeholder="Quote number, customer, phone..."
        hidden={{ bucket: query.bucket === "open" ? undefined : query.bucket }}
      />
      <OrderBucketNav
        active={query.bucket === "attention" ? "open" : query.bucket}
        extra={extra}
      />
      {visible.length === 0 ? (
        <EmptyState
          title="No orders here"
          description="Orders appear after an approved quote is sent to the customer."
        />
      ) : (
        <ul className={wellClass}>
          {visible.map((order) => {
            const workflowStatus = order.status as WorkflowStatus;
            const quote = rel(order.quotes);
            const version = rel(
              (quote as { quote_versions?: unknown } | null)?.quote_versions,
            ) as { total?: number | string } | null;
            const total = Number(version?.total ?? 0);
            const owner = names.get(order.assigned_sales_id ?? "");
            return (
              <JobRow
                key={order.id}
                href={`/orders/${order.id}`}
                title={quote?.quote_number ?? "Order"}
                subtitle={[rel(order.customers)?.name, owner]
                  .filter(Boolean)
                  .join(" · ")}
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
