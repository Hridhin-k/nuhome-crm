import { CustomerForm } from "@/components/customers/customer-form";
import { JobRow } from "@/components/app/job-row";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { Search } from "lucide-react";
import { listCustomers } from "@/lib/api/customers";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { latestOpenOrder } from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [user, { q }] = await Promise.all([requireUser(), searchParams]);
  const [customers, orders] = await Promise.all([
    listCustomers(q),
    listOrders(),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Customers"
        hideTitleOnMobile
        action={
          roleHasPermission(user.role, "customers.write") ? (
            <CustomerForm />
          ) : null
        }
      />
      <form className="relative mb-4">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-on-surface-variant/70"
          aria-hidden
        />
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search customers..."
          className="h-11 min-h-11 w-full rounded-lg border border-outline-variant bg-card px-3 pl-10 text-base text-on-surface placeholder:text-outline shadow-sm md:text-sm"
        />
      </form>
      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add a customer to start a quote."
          action={
            roleHasPermission(user.role, "customers.write") ? (
              <CustomerForm triggerClassName="w-full" />
            ) : undefined
          }
        />
      ) : (
        <ul className={wellClass}>
          {customers.map((customer) => {
            const related = orders.filter((o) => o.customer_id === customer.id);
            const latest = latestOpenOrder(related);
            return (
              <JobRow
                key={customer.id}
                href={`/customers/${customer.id}`}
                title={customer.name}
                subtitle={customer.phone ?? "No phone"}
                footer={
                  latest
                    ? `Latest: ${rel(latest.quotes)?.quote_number ?? "Order"}`
                    : "No orders yet"
                }
                status={latest ? (latest.status as WorkflowStatus) : undefined}
              />
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
