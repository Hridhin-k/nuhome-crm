import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { ListPager } from "@/components/app/list-pager";
import { ListSearchForm } from "@/components/app/list-search-form";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { OrderBucketNav } from "@/components/orders/order-bucket-nav";
import { listOrdersPage } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";
import { parsePage, parseYmd, pathWithQuery } from "@/lib/search";
import { orderRef } from "@/lib/orders/ref";
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
    credit?: string;
    page?: string;
  }>;
}) {
  const { status, bucket, q, from: fromRaw, to: toRaw, credit, page: pageRaw } =
    await searchParams;
  const from = parseYmd(fromRaw) ?? undefined;
  const to = parseYmd(toRaw) ?? undefined;
  const page = parsePage(pageRaw);
  const query = statusesForOrderQuery({ bucket, status });
  const extra = { q, from, to };
  const [, list] = await Promise.all([
    requireUser(),
    listOrdersPage({
      statuses: query.filter,
      q,
      from,
      to,
      credit: credit === "1",
      page,
    }),
  ]);
  const orders = list.rows;

  return (
    <PageFrame>
      <PageHeader
        title={credit === "1" ? "Credit delivery requests" : "Orders"}
        hideTitleOnMobile
        description="Search by quote number, phone, or date. Floor book is shared across sales."
      />
      <ListSearchForm
        action="/orders"
        q={q}
        from={from}
        to={to}
        showDates
        placeholder="Order ID, quote number, customer, phone..."
        hidden={{ bucket: query.bucket === "open" ? undefined : query.bucket }}
      />
      <OrderBucketNav
        active={query.bucket === "attention" ? "open" : query.bucket}
        extra={extra}
      />
      {orders.length === 0 ? (
        <EmptyState
          title="No orders here"
          description="Orders appear after an approved quote is sent to the customer."
        />
      ) : (
        <>
          <ul className={wellClass}>
            {orders.map((order) => {
              const workflowStatus = order.status as WorkflowStatus;
              const quote = rel(order.quotes);
              const version = rel(
                (quote as { quote_versions?: unknown } | null)?.quote_versions,
              ) as { total?: number | string } | null;
              const total = Number(version?.total ?? 0);
              const owner = rel(order.assigned_sales)?.full_name;
              return (
                <JobRow
                  key={order.id}
                  href={`/orders/${order.id}`}
                  title={orderRef(order)}
                  subtitle={[quote?.quote_number, rel(order.customers)?.name, owner]
                    .filter(Boolean)
                    .join(" · ")}
                  amount={total ? formatInr(total) : undefined}
                  hint={STATUS_NEXT_LINE[workflowStatus]}
                  status={workflowStatus}
                />
              );
            })}
          </ul>
          <ListPager
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefFor={(next) =>
              pathWithQuery("/orders", {
                ...extra,
                bucket: query.bucket === "open" ? undefined : query.bucket,
                credit: credit === "1" ? "1" : undefined,
                page: next > 1 ? String(next) : undefined,
              })
            }
          />
        </>
      )}
    </PageFrame>
  );
}
