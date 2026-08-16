import { CustomerForm } from "@/components/customers/customer-form";
import { JobRow } from "@/components/app/job-row";
import { ListSearchForm } from "@/components/app/list-search-form";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { listProfiles } from "@/lib/api/catalog";
import { listCustomers } from "@/lib/api/customers";
import { listOrderFooters } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { latestOpenOrder } from "@/lib/workflow/status-buckets";
import { orderRef } from "@/lib/orders/ref";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [user, customers, orders, profiles] = await Promise.all([
    requireUser(),
    listCustomers(q),
    listOrderFooters(),
    listProfiles(),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));

  return (
    <PageFrame>
      <PageHeader
        title="Customers"
        hideTitleOnMobile
        action={
          rolesHavePermission(user.roles, "customers.write") ? (
            <CustomerForm />
          ) : null
        }
      />
      <ListSearchForm
        action="/customers"
        q={q}
        placeholder="Name, phone, email, quote, or order ID"
      />
      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add a customer to start a quote."
          action={
            rolesHavePermission(user.roles, "customers.write") ? (
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
                    ? `Latest: ${orderRef(latest)}`
                    : names.get(customer.created_by ?? "")
                      ? `Walk-in · ${names.get(customer.created_by ?? "")}`
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
