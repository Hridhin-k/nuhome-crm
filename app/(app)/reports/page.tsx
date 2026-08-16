import { ActivityTimeline } from "@/components/app/activity-timeline";
import { FloorBoard } from "@/components/app/floor-board";
import { InboxList } from "@/components/app/inbox-list";
import { JobRow } from "@/components/app/job-row";
import { ListSearchForm } from "@/components/app/list-search-form";
import { OperationsPipeline } from "@/components/app/operations-pipeline";
import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { ReportExportBar } from "@/components/app/report-export-bar";
import { StatusFilterNav } from "@/components/app/status-filter-nav";
import { getOperationsSnapshot } from "@/lib/api/dashboard";
import {
  AUDIT_EXPORT_LIMIT,
  AUDIT_PAGE_LIMIT,
  getBusinessReport,
  listAdminAudit,
} from "@/lib/api/reports";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";
import {
  defaultDateRange,
  parseYmd,
  pathWithQuery,
} from "@/lib/search";
import { AUDIT_ACTIONS } from "@/lib/workflow/types";

const VIEWS = [
  { id: "floor", label: "Floor" },
  { id: "business", label: "Business" },
  { id: "pipeline", label: "Queues" },
  { id: "audit", label: "Audit" },
] as const;

type ReportView = (typeof VIEWS)[number]["id"];

function parseView(value?: string): ReportView {
  if (value === "business" || value === "pipeline" || value === "audit") {
    return value;
  }
  return "floor";
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
      <p className="text-label-caps text-on-surface-variant">{label}</p>
      <p className="mt-1 text-headline-md text-on-surface">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    from?: string;
    to?: string;
    q?: string;
    action?: string;
  }>;
}) {
  const params = await searchParams;
  const view = parseView(params.view);
  const fallback = defaultDateRange();
  const from = parseYmd(params.from) ?? fallback.from;
  const to = parseYmd(params.to) ?? fallback.to;
  const action = AUDIT_ACTIONS.find((item) => item === params.action);

  const [, snapshot, business, audit] = await Promise.all([
    requirePermission("admin.manage"),
    view === "pipeline" || view === "floor"
      ? getOperationsSnapshot()
      : Promise.resolve(null),
    view === "business" ? getBusinessReport(from, to) : Promise.resolve(null),
    view === "audit"
      ? listAdminAudit({ from, to, action, q: params.q })
      : Promise.resolve(null),
  ]);

  const range = { from, to, view };

  return (
    <PageFrame>
      <PageHeader
        title="Reports"
        hideTitleOnMobile
        description="Live floor, collections, queues, and a complete audit trail. Export CSV or print to PDF."
      />
      <StatusFilterNav
        ariaLabel="Report view"
        active={view}
        items={VIEWS.map((item) => ({ id: item.id, label: item.label }))}
        hrefFor={(id) => pathWithQuery("/reports", { view: id, from, to })}
      />
      {view === "floor" || view === "pipeline" ? null : (
        <ListSearchForm
          action="/reports"
          q={view === "audit" ? params.q : undefined}
          from={from}
          to={to}
          showDates
          placeholder={
            view === "audit"
              ? "Actor, action, or entity..."
              : "Date range applies to this view"
          }
          hidden={{ view, action }}
        />
      )}

      <ReportExportBar
        view={view}
        from={from}
        to={to}
        action={action}
        q={params.q}
      />

      {view === "floor" && snapshot ? (
        <FloorBoard
          census={snapshot.census}
          asOf={snapshot.asOf}
          overdue={snapshot.overdue}
          pendingPayments={snapshot.pendingPayments}
          pendingApprovals={snapshot.pendingApprovals}
          open={snapshot.open}
          customers={snapshot.customers}
          delivered={snapshot.delivered}
        />
      ) : null}

      {view === "business" && business ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric
              label="Collections"
              value={formatInr(business.collections)}
              hint={`${business.collectionCount} verified receipts`}
            />
            <Metric
              label="Quoted"
              value={formatInr(business.quoted)}
              hint="New quotes in range"
            />
            <Metric
              label="Margin"
              value={formatInr(business.margin)}
              hint="On quotes opened in range"
            />
            <Metric
              label="Delivered"
              value={String(business.delivered)}
              hint="Jobs closed in range"
            />
          </div>
          <section className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
            <h2 className="text-subheading text-on-surface">Vendor SLA</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {business.vendor.batches === 0
                ? "No vendor batches in this range."
                : `${business.vendor.onTime} on time · ${business.vendor.late} late GRN · ${business.vendor.overdueOpen} still overdue`}
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-subheading text-on-surface">
              Who is sitting on work
            </h2>
            {business.sitting.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                Nobody is holding open quotes, payments, or aging jobs.
              </p>
            ) : (
              <ul className={wellClass}>
                {business.sitting.map((row) => (
                  <JobRow
                    key={row.id}
                    href="/users"
                    title={row.name}
                    subtitle={row.role}
                    footer={`${row.waitingQuotes} quotes · ${row.pendingPayments} payments · ${row.agingOrders} aging`}
                    stacked
                  />
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-2 text-subheading text-on-surface">
              Aging jobs (3+ days)
            </h2>
            {business.aging.length === 0 ? (
              <p className="text-sm text-on-surface-variant">
                No open jobs older than three days.
              </p>
            ) : (
              <ul className={wellClass}>
                {business.aging.slice(0, 20).map((job) => (
                  <JobRow
                    key={job.id}
                    href={job.href}
                    title={job.title}
                    subtitle={job.owner}
                    footer={`${job.days} days`}
                    status={job.status}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {view === "pipeline" && snapshot ? (
        <>
          <OperationsPipeline
            stages={snapshot.stages}
            open={snapshot.open}
            customers={snapshot.customers}
            delivered={snapshot.delivered}
          />
          <div className="mt-5">
            <InboxList items={snapshot.queues} />
          </div>
        </>
      ) : null}

      {view === "audit" && audit ? (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-on-surface-variant">
            Showing the latest {Math.min(audit.length, AUDIT_PAGE_LIMIT)} events.
            CSV and PDF export up to {AUDIT_EXPORT_LIMIT.toLocaleString("en-IN")}.
          </p>
          <nav
            className="-mx-1 flex gap-2 overflow-x-auto pb-1"
            aria-label="Common audit actions"
          >
            {[
              "",
              "PAYMENT_VERIFIED",
              "ROLE_CHANGED",
              "WORK_REASSIGNED",
              "QUOTE_APPROVED",
            ].map((item) => (
              <a
                key={item || "all"}
                href={pathWithQuery("/reports", {
                  ...range,
                  view: "audit",
                  action: item || undefined,
                  q: params.q,
                })}
                className="shrink-0 rounded-full border border-outline-variant px-3 py-1 text-xs"
              >
                {item ? item.replaceAll("_", " ").toLowerCase() : "All"}
              </a>
            ))}
          </nav>
          <ActivityTimeline
            events={audit}
            emptyMessage="No audit events in this range."
          />
        </div>
      ) : null}
    </PageFrame>
  );
}
