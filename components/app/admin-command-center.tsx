import { AppLink } from "@/components/app/app-link";
import { HomeSection } from "@/components/app/home-hero";
import { JobRow } from "@/components/app/job-row";
import { ListSearchForm } from "@/components/app/list-search-form";
import { wellClass } from "@/components/app/page-frame";
import type { AdminCommandCenter } from "@/lib/api/admin-overview";
import { formatInr } from "@/lib/format/money";
import { pathWithQuery } from "@/lib/search";

function Metric({
  label,
  value,
  hint,
  href,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  alert?: boolean;
}) {
  const body = (
    <>
      <p
        className={`text-label-caps ${alert ? "text-on-error-container" : "text-on-surface-variant"}`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-headline-md tracking-tight tabular-nums ${alert ? "text-on-error-container" : "text-on-surface"}`}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={`mt-1 text-xs ${alert ? "text-on-error-container" : "text-on-surface-variant"}`}
        >
          {hint}
        </p>
      ) : null}
    </>
  );
  const className = alert
    ? "rounded-2xl border border-error/30 bg-error-container p-4"
    : "rounded-2xl border border-outline-variant bg-card p-4 shadow-card";
  if (href) {
    return (
      <AppLink href={href} className={`block h-full ${className}`}>
        {body}
      </AppLink>
    );
  }
  return <div className={className}>{body}</div>;
}

export function AdminCommandCenterView({
  data,
}: {
  data: AdminCommandCenter;
}) {
  const { catalog, sales, vendor } = data;
  const catalogIssues =
    catalog.materialsMissingCost +
    catalog.materialsMissingDescription +
    catalog.vendorsMissingContact +
    catalog.materialsInactive +
    catalog.vendorsInactive;

  return (
    <div className="space-y-8">
      <ListSearchForm
        action="/home"
        from={data.from}
        to={data.to}
        showDates
        placeholder="Date range for profit and sales"
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric
          label="Collections"
          value={formatInr(data.collections)}
          hint={`${data.collectionCount} verified receipts`}
          href={pathWithQuery("/reports", {
            view: "business",
            from: data.from,
            to: data.to,
          })}
        />
        <Metric
          label="Margin"
          value={formatInr(data.margin)}
          hint="Quoted profit in range"
          href={pathWithQuery("/reports", {
            view: "business",
            from: data.from,
            to: data.to,
          })}
        />
        <Metric
          label="Quoted"
          value={formatInr(data.quoted)}
          hint="New quotes in range"
        />
        <Metric
          label="Delivered"
          value={String(data.delivered)}
          hint="Jobs closed in range"
          href="/orders?bucket=closed"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric
          label="Stuck"
          value={String(data.stuck)}
          hint="Blocked on the floor"
          href="/reports?view=floor&stuck=1"
          alert={data.stuck > 0}
        />
        <Metric
          label="Overdue"
          value={String(data.overdue)}
          hint="Vendor past due"
          href="/fulfillment"
          alert={data.overdue > 0}
        />
        <Metric
          label="Open"
          value={String(data.open)}
          hint="Jobs still in play"
          href="/quotes"
        />
        <Metric
          label="Credit"
          value={String(data.creditRequested)}
          hint="Handover without full pay"
          href="/orders?credit=1"
          alert={data.creditRequested > 0}
        />
      </section>

      <HomeSection
        title="Sales executives"
        action={
          <AppLink
            href={pathWithQuery("/reports", {
              view: "business",
              from: data.from,
              to: data.to,
            })}
            className="text-body-sm text-primary"
          >
            Full report
          </AppLink>
        }
      >
        {sales.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No sales activity in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-card shadow-card">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-outline-variant text-label-caps text-on-surface-variant">
                <tr>
                  <th className="px-3 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Quotes</th>
                  <th className="px-3 py-3 font-medium">Quoted</th>
                  <th className="px-3 py-3 font-medium">Margin</th>
                  <th className="px-3 py-3 font-medium">Active</th>
                  <th className="px-3 py-3 font-medium">Done</th>
                  <th className="px-3 py-3 font-medium">Collected</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-outline-variant/60 last:border-0"
                  >
                    <td className="px-3 py-3 font-medium text-on-surface">
                      {row.name}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-on-surface-variant">
                      {row.quotes}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-on-surface-variant">
                      {formatInr(row.quoted)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-on-surface">
                      {formatInr(row.margin)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-on-surface-variant">
                      {row.activeOrders}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-on-surface-variant">
                      {row.delivered}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-on-surface">
                      {formatInr(row.collections)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </HomeSection>

      <HomeSection
        title="Inventory & vendors"
        action={
          <AppLink href="/materials" className="text-body-sm text-primary">
            Browse
          </AppLink>
        }
      >
        <ul className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            label="Materials"
            value={String(catalog.materialsActive)}
            hint={
              catalog.materialsInactive
                ? `${catalog.materialsInactive} inactive`
                : "Active SKUs"
            }
            href="/materials"
          />
          <Metric
            label="Vendors"
            value={String(catalog.vendorsActive)}
            hint={
              catalog.vendorsInactive
                ? `${catalog.vendorsInactive} inactive`
                : "Active vendors"
            }
            href="/vendors"
          />
          <Metric
            label="Missing cost"
            value={String(catalog.materialsMissingCost)}
            hint="Materials without cost"
            href="/materials"
            alert={catalog.materialsMissingCost > 0}
          />
          <Metric
            label="Vendor SLA"
            value={`${vendor.onTime}/${vendor.batches || 0}`}
            hint={
              vendor.batches === 0
                ? "No batches in range"
                : `${vendor.late} late · ${vendor.overdueOpen} overdue`
            }
            href="/fulfillment"
            alert={vendor.late > 0 || vendor.overdueOpen > 0}
          />
        </ul>
        {catalogIssues > 0 ? (
          <ul className={wellClass}>
            {catalog.materialsMissingDescription > 0 ? (
              <JobRow
                href="/materials"
                title={`${catalog.materialsMissingDescription} materials need a description`}
                subtitle="Shown on quote pickers"
                stacked
              />
            ) : null}
            {catalog.vendorsMissingContact > 0 ? (
              <JobRow
                href="/vendors"
                title={`${catalog.vendorsMissingContact} vendors missing contact`}
                subtitle="Phone or email required to send"
                stacked
              />
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-on-surface-variant">
            Catalog looks healthy — costs, descriptions, and vendor contacts are
            filled in.
          </p>
        )}
      </HomeSection>

      <HomeSection
        title="Oversight"
        action={
          <AppLink href="/reports" className="text-body-sm text-primary">
            All reports
          </AppLink>
        }
      >
        <ul className={wellClass}>
          <JobRow
            href="/reports?view=floor"
            title="Floor board"
            subtitle="Every status across the shop"
            stacked
          />
          <JobRow
            href={pathWithQuery("/reports", {
              view: "business",
              from: data.from,
              to: data.to,
            })}
            title="Business & collections"
            subtitle="Profit, sitting work, aging jobs"
            stacked
          />
          <JobRow
            href="/reports?view=pipeline"
            title="Operations queues"
            subtitle="Who is waiting on what"
            stacked
          />
          <JobRow
            href="/users"
            title="Staff directory"
            subtitle="Roles and coverage — Ops owns day-to-day edits"
            stacked
          />
        </ul>
      </HomeSection>
    </div>
  );
}
