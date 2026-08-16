import { PrintDocumentButton } from "@/components/app/print-document-button";
import { PageFrame } from "@/components/app/page-frame";
import { STATUS_LABELS } from "@/lib/workflow/labels";
import { formatAuditEvent } from "@/lib/workflow/audit-labels";
import {
  getBusinessReport,
  listCollections,
  type AgingJob,
  type CollectionRow,
  type SittingRow,
} from "@/lib/api/reports";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";
import {
  loadReportExport,
  parseExportKind,
  type ExportKind,
  type ReportExport,
} from "@/lib/reports/load-export";
import { defaultDateRange, formatIstDateTime, parseYmd } from "@/lib/search";

export const dynamic = "force-dynamic";

type PrintKind = ExportKind | "business";

function parsePrintKind(value?: string | null): PrintKind {
  if (value === "business") return "business";
  return parseExportKind(value) ?? "floor";
}

const TITLES: Record<PrintKind, string> = {
  floor: "Floor board",
  queues: "Operations queues",
  audit: "Audit log",
  collections: "Collections",
  sitting: "Who is sitting on work",
  aging: "Aging jobs",
  business: "Business report",
};

export default async function ReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    from?: string;
    to?: string;
    action?: string;
    q?: string;
  }>;
}) {
  await requirePermission("admin.manage");
  const params = await searchParams;
  const kind = parsePrintKind(params.kind);
  const fallback = defaultDateRange();
  const from = parseYmd(params.from) ?? fallback.from;
  const to = parseYmd(params.to) ?? fallback.to;
  const query = {
    from,
    to,
    action: params.action,
    q: params.q,
  };

  const [payload, businessPack] = await Promise.all([
    kind === "business" ? Promise.resolve(null) : loadReportExport(kind, query),
    kind === "business"
      ? Promise.all([getBusinessReport(from, to), listCollections(from, to)])
      : Promise.resolve(null),
  ]);
  const business = businessPack?.[0] ?? null;
  const collections = businessPack?.[1] ?? null;

  return (
    <PageFrame width="wide">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label-caps text-on-surface-variant">Nuhome</p>
          <h1 className="text-headline-lg text-on-surface">{TITLES[kind]}</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {kind === "floor" || kind === "queues"
              ? `As of ${formatIstDateTime()} IST`
              : `${from} → ${to} · printed ${formatIstDateTime()} IST`}
          </p>
        </div>
        <PrintDocumentButton />
      </header>

      {kind === "business" && business ? (
        <BusinessPrint
          business={business}
          collections={collections ?? []}
        />
      ) : null}

      {payload ? <ExportPrint payload={payload} /> : null}
    </PageFrame>
  );
}

function ExportPrint({ payload }: { payload: ReportExport }) {
  if (payload.kind === "audit") {
    return (
      <PrintTable
        headers={["When", "Event", "Detail", "Actor", "Entity"]}
        rows={payload.events.map((event) => {
          const formatted = formatAuditEvent(event);
          return [
            formatIstDateTime(event.created_at),
            formatted.title,
            formatted.detail ?? event.action,
            formatted.actor,
            `${event.entity_type} ${event.entity_id ?? ""}`.trim(),
          ];
        })}
        empty="No audit events in this range."
      />
    );
  }
  if (payload.kind === "floor") {
    return (
      <PrintTable
        headers={["Status", "Jobs"]}
        rows={payload.snapshot.census.map((cell) => [
          STATUS_LABELS[cell.status],
          String(cell.count),
        ])}
      />
    );
  }
  if (payload.kind === "queues") {
    return (
      <PrintTable
        headers={["Queue", "Count", "Detail"]}
        rows={payload.snapshot.queues.map((queue) => [
          queue.title,
          String(queue.count),
          queue.detail,
        ])}
      />
    );
  }
  if (payload.kind === "collections") {
    return <CollectionsTable rows={payload.rows} />;
  }
  if (payload.kind === "sitting") {
    return <SittingTable rows={payload.rows} />;
  }
  return <AgingTable rows={payload.rows} />;
}

function BusinessPrint({
  business,
  collections,
}: {
  business: Awaited<ReturnType<typeof getBusinessReport>>;
  collections: CollectionRow[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Collections", formatInr(business.collections)],
          ["Quoted", formatInr(business.quoted)],
          ["Margin", formatInr(business.margin)],
          ["Delivered", String(business.delivered)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-outline-variant bg-card p-3"
          >
            <dt className="text-label-caps text-on-surface-variant">{label}</dt>
            <dd className="mt-1 text-headline-sm text-on-surface">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body-sm text-on-surface-variant">
        Vendor SLA: {business.vendor.onTime} on time · {business.vendor.late} late
        · {business.vendor.overdueOpen} still overdue
      </p>
      <section>
        <h2 className="mb-2 text-subheading">Collections</h2>
        <CollectionsTable rows={collections} />
      </section>
      <section>
        <h2 className="mb-2 text-subheading">Sitting on work</h2>
        <SittingTable rows={business.sitting} />
      </section>
      <section>
        <h2 className="mb-2 text-subheading">Aging jobs</h2>
        <AgingTable rows={business.aging} />
      </section>
    </div>
  );
}

function CollectionsTable({ rows }: { rows: CollectionRow[] }) {
  return (
    <PrintTable
      headers={["When", "Quote", "Amount", "Kind", "Method", "By"]}
      rows={rows.map((row) => [
        formatIstDateTime(row.paidAt),
        row.quoteNumber,
        formatInr(row.amount),
        row.kind,
        row.method,
        row.recordedBy,
      ])}
      empty="No verified receipts in this range."
    />
  );
}

function SittingTable({ rows }: { rows: SittingRow[] }) {
  return (
    <PrintTable
      headers={["Staff", "Role", "Quotes", "Payments", "Aging"]}
      rows={rows.map((row) => [
        row.name,
        row.role,
        String(row.waitingQuotes),
        String(row.pendingPayments),
        String(row.agingOrders),
      ])}
      empty="Nobody is holding open work."
    />
  );
}

function AgingTable({ rows }: { rows: AgingJob[] }) {
  return (
    <PrintTable
      headers={["Quote", "Owner", "Days", "Status"]}
      rows={rows.map((row) => [
        row.title,
        row.owner,
        String(row.days),
        STATUS_LABELS[row.status],
      ])}
      empty="No jobs older than three days."
    />
  );
}

function PrintTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: string[][];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-body-sm text-on-surface-variant">{empty ?? "Nothing to print."}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[11px] md:text-body-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-outline-variant py-2 pr-3 font-semibold text-on-surface"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${headers[cellIndex]}-${cellIndex}`}
                  className="border-b border-outline-variant/50 py-2 pr-3 text-on-surface"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
