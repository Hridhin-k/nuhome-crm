import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { CustomerForm } from "@/components/customers/customer-form";
import { buttonVariants } from "@/components/ui/button";
import { listCustomers } from "@/lib/api/customers";
import { listQuotes } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format/money";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const user = await requireUser();
  const { notice } = await searchParams;
  const canCreate = roleHasPermission(user.role, "quotes.create");
  const [quotes, customers] = await Promise.all([
    listQuotes(),
    canCreate ? listCustomers() : Promise.resolve([]),
  ]);

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
      <PageHeader title="Quotes" action={quotes.length > 0 ? newQuoteAction : null} />
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
        <ul className="grid gap-3 md:grid-cols-2">
          {quotes.map((quote) => {
            const version = rel(quote.quote_versions);
            return (
              <li key={quote.id}>
                <AppLink
                  href={`/quotes/${quote.id}`}
                  className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{quote.quote_number}</p>
                    <StatusBadge status={quote.status as WorkflowStatus} />
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {rel(quote.customers)?.name} ·{" "}
                    {formatInr(Number(version?.total ?? 0))}
                  </p>
                </AppLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
