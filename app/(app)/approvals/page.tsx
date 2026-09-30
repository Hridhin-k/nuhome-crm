import { EmptyState } from "@/components/app/empty-state";
import { listRowClass, PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { AppLink } from "@/components/app/app-link";
import { listPendingApprovals } from "@/lib/api/quotes";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";
import { relativeTime } from "@/lib/format/relative-time";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
                  className={cn(listRowClass, "flex flex-col gap-2")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-label-caps text-on-surface-variant">
                      {quote.quote_number}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
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
                    <Badge variant={thin ? "destructive" : "secondary"}>
                      {thin ? <AlertTriangle aria-hidden /> : null}
                      Margin {Math.round(marginPct)}%
                    </Badge>
                    <span className="text-subheading text-primary underline underline-offset-2">
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
