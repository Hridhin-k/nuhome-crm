import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { AppLink } from "@/components/app/app-link";
import { listPendingApprovals } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";
import { relativeTime } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

const THIN_MARGIN = 15;

export default async function ApprovalsPage() {
  const [, quotes] = await Promise.all([
    requirePermission("quotes.approve"),
    listPendingApprovals(),
  ]);

  return (
    <PageFrame>
      <PageHeader
        title="Approvals"
        description="Selling price, discount, and margin."
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
            const total = Number(version?.total ?? 0);
            const marginAmount = Number(version?.margin_amount ?? 0);
            const marginPct =
              Number(version?.margin_percent) ||
              (total > 0 ? (marginAmount / total) * 100 : 0);
            const thin = marginPct > 0 && marginPct < THIN_MARGIN;
            return (
              <li key={quote.id}>
                <AppLink
                  href={`/quotes/${quote.id}`}
                  className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-card p-4 shadow-card transition-colors hover:bg-surface-container-low"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-label-caps text-on-surface-variant">
                      {quote.quote_number}
                    </span>
                    <span className="text-body-sm text-secondary">
                      {relativeTime(quote.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="truncate pr-4 text-subheading text-on-surface">
                      {rel(quote.customers)?.name ?? "Customer"}
                    </h2>
                    <span className="shrink-0 text-data-tabular text-primary">
                      {formatInr(total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                        thin
                          ? "border-error/20 bg-error-container text-on-error-container"
                          : "border-surface-dim bg-surface-container-high text-on-surface-variant",
                      )}
                    >
                      Margin {Math.round(marginPct)}%
                    </span>
                    <span className="text-[13px] text-subheading text-primary underline underline-offset-2">
                      Review
                    </span>
                  </div>
                </AppLink>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
