import { CustomerForm } from "@/components/customers/customer-form";
import { AppLink } from "@/components/app/app-link";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { StatusBadge } from "@/components/app/status-badge";
import { listCustomers } from "@/lib/api/customers";
import { listOrders } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;
  const [customers, orders] = await Promise.all([
    listCustomers(q),
    listOrders(),
  ]);

  return (
    <div>
      <PageHeader
        title="Customers"
        action={
          roleHasPermission(user.role, "customers.write") ? (
            <CustomerForm />
          ) : null
        }
      />
      <form className="mb-4">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search name or phone"
          className="h-11 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3.5 text-on-surface placeholder:text-outline"
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
        <ul className="flex flex-col gap-3">
          {customers.map((customer) => {
            const related = orders.filter((o) => o.customer_id === customer.id);
            const latest = related[0];
            return (
              <li key={customer.id}>
                <AppLink
                  href={`/customers/${customer.id}`}
                  className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-card transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-on-surface-variant">
                        {customer.phone ?? "No phone"}
                      </p>
                    </div>
                    {latest ? (
                      <StatusBadge status={latest.status as WorkflowStatus} />
                    ) : null}
                  </div>
                  {latest ? (
                    <p className="mt-2 text-sm text-on-surface-variant">
                      Latest: {rel(latest.quotes)?.quote_number ?? "Order"}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-on-surface-variant">No orders yet</p>
                  )}
                </AppLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
