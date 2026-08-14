import { AppLink } from "@/components/app/app-link";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { listPendingApprovals } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";

export default async function ApprovalsPage() {
  const [, quotes] = await Promise.all([
    requirePermission("quotes.approve"),
    listPendingApprovals(),
  ]);

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Review quotes submitted by Sales. Rejected quotes return for revision."
      />
      {quotes.length === 0 ? (
        <EmptyState
          title="No pending quote approvals"
          description="When Sales submits a quote, it will land here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {quotes.map((quote) => {
            const version = rel(quote.quote_versions);
            return (
              <li key={quote.id}>
                <AppLink
                  href={`/approvals/${quote.id}`}
                  className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card"
                >
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{quote.quote_number}</p>
                    <StatusBadge status="quote_pending_accounts" />
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {rel(quote.customers)?.name} · v{version?.version_number} ·{" "}
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
