import { AppLink } from "@/components/app/app-link";
import { notFound } from "next/navigation";
import { JobRow } from "@/components/app/job-row";
import { Notice } from "@/components/app/notice";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { buttonVariants } from "@/components/ui/button";
import { getCustomer } from "@/lib/api/customers";
import { listOrdersForCustomer } from "@/lib/api/orders";
import { listQuotesForCustomer } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format/money";
import { cn } from "@/lib/utils";
import { canRecordPayment } from "@/lib/workflow/payment-recording";
import { displayWorkflowStatus } from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { notice } = await searchParams;
  const [customer, theirs, theirOrders] = await Promise.all([
    getCustomer(id),
    listQuotesForCustomer(id),
    listOrdersForCustomer(id),
  ]);
  if (!customer) {
    notFound();
  }

  const payableOrder = theirOrders.find((order) =>
    canRecordPayment({
      status: order.status as WorkflowStatus,
      payments: [],
      outstanding: 1,
    }),
  );

  return (
    <PageFrame width="detail" className="flex flex-col gap-5">
      <PageHeader
        title={customer.name}
        description={customer.phone ?? customer.email ?? ""}
        action={
          roleHasPermission(user.role, "customers.write") ? (
            <CustomerForm
              customer={customer}
              trigger={
                <span className="inline-flex h-9 min-h-9 items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-[13px] font-medium text-primary">
                  Edit
                </span>
              }
            />
          ) : null
        }
      />
      {notice === "updated" ? <Notice>Customer updated.</Notice> : null}
      {customer.address ? (
        <p className="text-sm text-on-surface-variant">{customer.address}</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
        {roleHasPermission(user.role, "quotes.create") ? (
          <AppLink
            href={`/walk-in?customerId=${id}&step=2`}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Create quote
          </AppLink>
        ) : null}
        {roleHasPermission(user.role, "payments.record") && payableOrder ? (
          <AppLink
            href={`/orders/${payableOrder.id}#payment`}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            Record payment
          </AppLink>
        ) : null}
      </div>

      <section>
        <h2 className="mb-3 text-subheading text-on-surface">Quotes</h2>
        {theirs.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No quotes yet.</p>
        ) : (
          <ul className={wellClass}>
            {theirs.map((quote) => {
              const version = rel(quote.quote_versions);
              const order = quote.order;
              const status = displayWorkflowStatus(
                quote.status as WorkflowStatus,
                order?.status as WorkflowStatus | undefined,
              );
              return (
                <JobRow
                  key={quote.id}
                  href={order ? `/orders/${order.id}` : `/quotes/${quote.id}`}
                  title={quote.quote_number}
                  subtitle={formatInr(Number(version?.total ?? 0))}
                  status={status}
                />
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-subheading text-on-surface">Orders</h2>
        <ul className={wellClass}>
          {theirOrders.map((order) => (
            <JobRow
              key={order.id}
              href={`/orders/${order.id}`}
              title={rel(order.quotes)?.quote_number ?? "Order"}
              status={order.status as WorkflowStatus}
            />
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}
