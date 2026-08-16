import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { Notice } from "@/components/app/notice";
import { ListSearchForm } from "@/components/app/list-search-form";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { StatusFilterNav } from "@/components/app/status-filter-nav";
import { CustomerForm } from "@/components/customers/customer-form";
import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import { listProfiles } from "@/lib/api/catalog";
import { listCustomers } from "@/lib/api/customers";
import { listQuotes } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format/money";
import { inDateRange, matchesSearch, parseYmd, pathWithQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { STATUS_NEXT_LINE } from "@/lib/workflow/labels";
import {
  displayWorkflowStatus,
  parseQuoteGroup,
  QUOTE_GROUP_IDS,
  QUOTE_GROUP_LABELS,
  QUOTE_GROUP_STATUSES,
} from "@/lib/workflow/status-buckets";
import { parseWorkflowStatus, type WorkflowStatus } from "@/lib/workflow/types";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    notice?: string;
    group?: string;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const [user, { notice, group, status, q, from: fromRaw, to: toRaw }, quotes, allCustomers, profiles] =
    await Promise.all([
    requireUser(),
    searchParams,
    listQuotes(),
    listCustomers(),
    listProfiles(),
  ]);
  const from = parseYmd(fromRaw) ?? undefined;
  const to = parseYmd(toRaw) ?? undefined;
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));
  const activeGroup = parseQuoteGroup(group);
  const exactStatus = parseWorkflowStatus(status);
  const canCreate = rolesHavePermission(user.roles, "quotes.create");
  const customers = canCreate ? allCustomers : [];

  const allowed = new Set(QUOTE_GROUP_STATUSES[activeGroup]);
  const visible = quotes.filter((quote) => {
    const status = displayWorkflowStatus(
      quote.status as WorkflowStatus,
      quote.order?.status as WorkflowStatus | undefined,
    );
    const customer = rel(quote.customers);
    return (
      allowed.has(status) &&
      (!exactStatus || status === exactStatus) &&
      matchesSearch(
        [
          quote.quote_number,
          customer?.name,
          customer?.phone,
          names.get(quote.created_by),
        ],
        q,
      ) &&
      inDateRange(quote.updated_at, from, to)
    );
  });

  const newQuoteAction =
    canCreate && customers.length > 0 ? (
      <AppLink
        href="/walk-in"
        className={cn(buttonVariants({ size: "default" }), "inline-flex")}
      >
        New quote
      </AppLink>
    ) : null;

  return (
    <PageFrame>
      <PageHeader
        title="Quotes"
        description="Floor book is shared. Search by quote number, phone, or date."
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
          <ListSearchForm
            action="/quotes"
            q={q}
            from={from}
            to={to}
            showDates
            placeholder="Quote number, customer, phone..."
            hidden={{
              group: activeGroup === "open" ? undefined : activeGroup,
              status: exactStatus,
            }}
          />
          <StatusFilterNav
            ariaLabel="Quote status"
            active={activeGroup}
            items={QUOTE_GROUP_IDS.map((id) => ({
              id,
              label: QUOTE_GROUP_LABELS[id],
            }))}
            hrefFor={(id) =>
              id === "open"
                ? pathWithQuery("/quotes", { q, from, to })
                : pathWithQuery("/quotes", { q, from, to, group: id })
            }
          />
          {visible.length === 0 ? (
            <EmptyState
              title="Nothing in this status"
              description="Try Open to see every job that is still in progress."
            />
          ) : (
            <ul className={wellClass}>
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
                  <JobRow
                    key={quote.id}
                    href={href}
                    title={quote.quote_number}
                    subtitle={[
                      rel(quote.customers)?.name ?? "Customer",
                      names.get(quote.created_by),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    amount={formatInr(Number(version?.total ?? 0))}
                    hint={STATUS_NEXT_LINE[status]}
                    status={status}
                  />
                );
              })}
            </ul>
          )}
        </>
      )}
    </PageFrame>
  );
}
