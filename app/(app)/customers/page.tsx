import { CustomerForm } from "@/components/customers/customer-form";
import { JobRow } from "@/components/app/job-row";
import { ListPager } from "@/components/app/list-pager";
import { ListSearchForm } from "@/components/app/list-search-form";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { listProfiles } from "@/lib/api/catalog";
import { listCustomersPage } from "@/lib/api/customers";
import { listCustomerLatestOrders } from "@/lib/api/orders";
import { requirePermission } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { parsePage, pathWithQuery } from "@/lib/search";
import { orderRef } from "@/lib/orders/ref";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageRaw } = await searchParams;
  const page = parsePage(pageRaw);
  const [user, list, profiles] = await Promise.all([
    requirePermission("customers.read"),
    listCustomersPage({ q, page }),
    listProfiles(),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));
  const latest = await listCustomerLatestOrders(list.rows.map((row) => row.id));
  const latestByCustomer = new Map(latest.map((row) => [row.customer_id, row]));

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
      {list.rows.length === 0 ? (
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
        <>
          <ul className={wellClass}>
            {list.rows.map((customer) => {
              const order = latestByCustomer.get(customer.id);
              return (
                <JobRow
                  key={customer.id}
                  href={`/customers/${customer.id}`}
                  title={customer.name}
                  subtitle={customer.phone ?? "No phone"}
                  footer={
                    order
                      ? `Latest: ${orderRef(order)}`
                      : names.get(customer.created_by ?? "")
                        ? `Walk-in · ${names.get(customer.created_by ?? "")}`
                        : "No orders yet"
                  }
                  status={order ? (order.status as WorkflowStatus) : undefined}
                />
              );
            })}
          </ul>
          <ListPager
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefFor={(next) =>
              pathWithQuery("/customers", {
                q,
                page: next > 1 ? String(next) : undefined,
              })
            }
          />
        </>
      )}
    </PageFrame>
  );
}
