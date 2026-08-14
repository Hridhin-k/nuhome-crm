import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { StatusFilterNav } from "@/components/app/status-filter-nav";
import { CustomerForm } from "@/components/customers/customer-form";
import { buttonVariants } from "@/components/ui/button";
import { listCustomers } from "@/lib/api/customers";
import { listQuotes } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format/money";
import { cn } from "@/lib/utils";
import { STATUS_NEXT_LINE } from "@/lib/workflow/labels";
import {
  displayWorkflowStatus,
  parseQuoteGroup,
  QUOTE_GROUP_IDS,
  QUOTE_GROUP_LABELS,
  QUOTE_GROUP_STATUSES,
} from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; group?: string }>;
}) {
  const [user, { notice, group }, quotes, allCustomers] = await Promise.all([
    requireUser(),
    searchParams,
    listQuotes(),
    listCustomers(),
  ]);
  const activeGroup = parseQuoteGroup(group);
  const canCreate = roleHasPermission(user.role, "quotes.create");
  const customers = canCreate ? allCustomers : [];

  const allowed = new Set(QUOTE_GROUP_STATUSES[activeGroup]);
  const visible = quotes.filter((quote) => {
    const status = displayWorkflowStatus(
      quote.status as WorkflowStatus,
      quote.order?.status as WorkflowStatus | undefined,
    );
    return allowed.has(status);
  });

  const newQuoteAction =
    canCreate && customers.length > 0 ? (
      <AppLink
        href="/walk-in"
        className={cn(
          buttonVariants({ size: "default" }),
          "inline-flex h-11 items-center px-6",
        )}
      >
        New quote
      </AppLink>
    ) : null;

  return (
    <div>
      <PageHeader
        title="Quotes"
        description="Live job status — closed work stays under Closed."
        action={quotes.length > 0 ? newQuoteAction : null}
      />
      {notice === "submitted" ? (
        <Notice>Sent to Accounts for review.</Notice>
      ) : null}
      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="Create a quote to get started."
          action={
            newQuoteAction ??
            (canCreate ? (
              <CustomerForm triggerClassName="w-full" returnTo="/walk-in" />
            ) : undefined)
          }
        />
      ) : (
        <>
          <StatusFilterNav
            ariaLabel="Quote status"
            active={activeGroup}
            items={QUOTE_GROUP_IDS.map((id) => ({
              id,
              label: QUOTE_GROUP_LABELS[id],
            }))}
            hrefFor={(id) => (id === "open" ? "/quotes" : `/quotes?group=${id}`)}
          />
          {visible.length === 0 ? (
            <EmptyState
              title="Nothing in this status"
              description="Try Open to see every job that is still in progress."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {visible.map((quote) => {
                const version = rel(quote.quote_versions);
                const status = displayWorkflowStatus(
                  quote.status as WorkflowStatus,
                  quote.order?.status as WorkflowStatus | undefined,
                );
                const href = quote.order
                  ? `/orders/${quote.order.id}`
                  : `/quotes/${quote.id}`;
                return (
                  <li key={quote.id}>
                    <AppLink
                      href={href}
                      className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex justify-between gap-3">
                        <p className="font-medium">{quote.quote_number}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        {rel(quote.customers)?.name} ·{" "}
                        {formatInr(Number(version?.total ?? 0))}
                      </p>
                      <p className="mt-3 text-sm text-on-surface">
                        {STATUS_NEXT_LINE[status]}
                      </p>
                    </AppLink>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
