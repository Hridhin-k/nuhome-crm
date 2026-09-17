import { EmptyState } from "@/components/app/empty-state";
import { JobRow } from "@/components/app/job-row";
import { Notice } from "@/components/app/notice";
import { ListPager } from "@/components/app/list-pager";
import { ListSearchForm } from "@/components/app/list-search-form";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { StatusFilterNav } from "@/components/app/status-filter-nav";
import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import { listFloorJobs } from "@/lib/api/quotes";
import { requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format/money";
import { parsePage, parseYmd, pathWithQuery } from "@/lib/search";
import { cn } from "@/lib/utils";
import { STATUS_NEXT_LINE } from "@/lib/workflow/labels";
import {
  parseQuoteGroup,
  QUOTE_GROUP_IDS,
  QUOTE_GROUP_LABELS,
  QUOTE_GROUP_STATUSES,
} from "@/lib/workflow/status-buckets";
import { parseWorkflowStatus } from "@/lib/workflow/types";

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
    page?: string;
  }>;
}) {
  const [user, { notice, group, status, q, from: fromRaw, to: toRaw, page: pageRaw }] =
    await Promise.all([requireUser(), searchParams]);
  const from = parseYmd(fromRaw) ?? undefined;
  const to = parseYmd(toRaw) ?? undefined;
  const page = parsePage(pageRaw);
  const activeGroup = parseQuoteGroup(group);
  const exactStatus = parseWorkflowStatus(status);
  const canCreate = rolesHavePermission(user.roles, "quotes.create");
  const list = await listFloorJobs({
    statuses: QUOTE_GROUP_STATUSES[activeGroup],
    exactStatus,
    q,
    from,
    to,
    page,
  });

  const newQuoteAction = canCreate ? (
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
        description="Floor book is shared. Search by quote number, order ID, phone, or date."
        action={list.total > 0 ? newQuoteAction : null}
      />
      {notice === "submitted" ? (
        <Notice>Sent to Accounts for review.</Notice>
      ) : null}
      {list.total === 0 && !q && !from && !to && activeGroup === "open" ? (
        <EmptyState
          title="No quotes yet"
          description="Create a quote to get started."
          action={newQuoteAction ?? undefined}
        />
      ) : (
        <>
          <ListSearchForm
            action="/quotes"
            q={q}
            from={from}
            to={to}
            showDates
            placeholder="Quote number, order ID, customer, phone..."
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
          {list.rows.length === 0 ? (
            <EmptyState
              title="Nothing in this status"
              description="Try Open to see every job that is still in progress."
            />
          ) : (
            <>
              <ul className={wellClass}>
                {list.rows.map((quote) => {
                  const href =
                    quote.live_status === "cancelled" || !quote.order_id
                      ? `/quotes/${quote.id}`
                      : `/orders/${quote.order_id}`;
                  return (
                    <JobRow
                      key={quote.id}
                      href={href}
                      title={quote.order_number ?? quote.quote_number}
                      subtitle={[
                        quote.order_id ? quote.quote_number : null,
                        quote.customer_name ?? "Customer",
                        quote.created_by_name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      amount={formatInr(Number(quote.version_total ?? 0))}
                      hint={STATUS_NEXT_LINE[quote.live_status]}
                      status={quote.live_status}
                    />
                  );
                })}
              </ul>
              <ListPager
                page={list.page}
                pageSize={list.pageSize}
                total={list.total}
                hrefFor={(next) =>
                  pathWithQuery("/quotes", {
                    q,
                    from,
                    to,
                    group: activeGroup === "open" ? undefined : activeGroup,
                    status: exactStatus,
                    page: next > 1 ? String(next) : undefined,
                  })
                }
              />
            </>
          )}
        </>
      )}
    </PageFrame>
  );
}
