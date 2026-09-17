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
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function ReadyPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageRaw } = await searchParams;
  const page = parsePage(pageRaw);
  const [, list] = await Promise.all([
    requirePermission("deliveries.complete"),
    listOrdersPage({ statuses: "delivery_unlocked", page }),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Ready for delivery"
        hideTitleOnMobile
        description="Full payment verified. Complete handover with the customer."
      />
      {list.rows.length === 0 ? (
        <EmptyState
          title="No deliveries ready"
          description="Unlocked orders appear here after full payment is verified."
        />
      ) : (
        <>
          <ul className={wellClass}>
            {list.rows.map((order) => (
              <JobRow
                key={order.id}
                href={`/orders/${order.id}`}
                title={orderRef(order)}
                subtitle={[
                  rel(order.quotes)?.quote_number,
                  rel(order.customers)?.name,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined}
                hint="Complete handover with the customer."
                status={order.status as WorkflowStatus}
              />
            ))}
          </ul>
          <ListPager
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefFor={(next) =>
              pathWithQuery("/ready", {
                page: next > 1 ? String(next) : undefined,
              })
            }
          />
        </>
      )}
    </PageFrame>
  );
}
