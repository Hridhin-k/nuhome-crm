import { AppLink } from "@/components/app/app-link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getCustomer } from "@/lib/api/customers";
import { listOrdersForCustomer } from "@/lib/api/orders";
import { listQuotesForCustomer } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format/money";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [customer, theirs, theirOrders] = await Promise.all([
    getCustomer(id),
    listQuotesForCustomer(id),
    listOrdersForCustomer(id),
  ]);
  if (!customer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customer.name}
        description={customer.phone ?? customer.email ?? ""}
      />
      {customer.address ? (
        <p className="text-sm text-on-surface-variant">{customer.address}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {roleHasPermission(user.role, "quotes.create") ? (
          <AppLink
            href={`/walk-in?customerId=${id}&step=2`}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Create quote
          </AppLink>
        ) : null}
        {roleHasPermission(user.role, "payments.record") && theirOrders[0] ? (
          <AppLink
            href={`/orders/${theirOrders[0].id}#payment`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Record payment
          </AppLink>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Quotes</h2>
        <ul className="flex flex-col gap-2">
          {theirs.map((quote) => {
            const version = rel(quote.quote_versions);
            return (
              <li key={quote.id}>
                <AppLink
                  href={`/quotes/${quote.id}`}
                  className="flex items-center justify-between rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-3"
                >
                  <span>
                    <span className="font-medium">{quote.quote_number}</span>
                    <span className="ml-2 text-sm text-on-surface-variant">
                      {formatInr(Number(version?.total ?? 0))}
                    </span>
                  </span>
                  <StatusBadge status={quote.status as WorkflowStatus} />
                </AppLink>
              </li>
            );
          })}
          {theirs.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No quotes yet.</p>
          ) : null}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Orders</h2>
        <ul className="flex flex-col gap-2">
          {theirOrders.map((order) => (
            <li key={order.id}>
              <AppLink
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-3"
              >
                <span className="font-medium">
                  {rel(order.quotes)?.quote_number ?? "Order"}
                </span>
                <StatusBadge status={order.status as WorkflowStatus} />
              </AppLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
