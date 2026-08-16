import { toCsv } from "@/lib/csv";
import { formatIstDateTime, kolkataDate } from "@/lib/search";
import { STATUS_LABELS } from "@/lib/workflow/labels";
import { formatAuditEvent, type AuditEvent } from "@/lib/workflow/audit-labels";
import type { OperationsSnapshot } from "@/lib/api/dashboard";
import type {
  AgingJob,
  CollectionRow,
  SittingRow,
} from "@/lib/api/reports";
import type { ExportKind, ReportExport } from "@/lib/reports/load-export";

export function csvFilename(kind: ExportKind, from?: string, to?: string) {
  const range = from && to ? `${from}-to-${to}` : kolkataDate();
  return `nuhome-${kind}-${range}.csv`;
}

export function reportExportToCsv(payload: ReportExport): {
  filename: string;
  csv: string;
} {
  if (payload.kind === "audit") {
    return {
      filename: csvFilename("audit", payload.from, payload.to),
      csv: auditCsv(payload.events),
    };
  }
  if (payload.kind === "floor") {
    return { filename: csvFilename("floor"), csv: floorCsv(payload.snapshot) };
  }
  if (payload.kind === "queues") {
    return { filename: csvFilename("queues"), csv: queuesCsv(payload.snapshot) };
  }
  if (payload.kind === "collections") {
    return {
      filename: csvFilename("collections", payload.from, payload.to),
      csv: collectionsCsv(payload.rows),
    };
  }
  if (payload.kind === "sitting") {
    return {
      filename: csvFilename("sitting", payload.from, payload.to),
      csv: sittingCsv(payload.rows),
    };
  }
  return {
    filename: csvFilename("aging", payload.from, payload.to),
    csv: agingCsv(payload.rows),
  };
}

export function withExcelBom(csv: string) {
  return `\uFEFF${csv}`;
}

export function auditCsv(events: AuditEvent[]) {
  return toCsv(
    [
      "when_ist",
      "action",
      "title",
      "detail",
      "actor",
      "entity_type",
      "entity_id",
      "from_state",
      "to_state",
    ],
    events.map((event) => {
      const formatted = formatAuditEvent(event);
      return [
        formatIstDateTime(event.created_at),
        event.action,
        formatted.title,
        formatted.detail ?? "",
        formatted.actor,
        event.entity_type,
        event.entity_id,
        event.old_state,
        event.new_state,
      ];
    }),
  );
}

export function floorCsv(snapshot: OperationsSnapshot) {
  return toCsv(
    ["status", "label", "jobs"],
    snapshot.census.map((cell) => [
      cell.status,
      STATUS_LABELS[cell.status],
      cell.count,
    ]),
  );
}

export function queuesCsv(snapshot: OperationsSnapshot) {
  return toCsv(
    ["queue", "count", "detail"],
    snapshot.queues.map((queue) => [queue.title, queue.count, queue.detail]),
  );
}

export function collectionsCsv(rows: CollectionRow[]) {
  return toCsv(
    ["paid_at_ist", "quote", "amount", "kind", "method", "reference", "recorded_by"],
    rows.map((row) => [
      formatIstDateTime(row.paidAt),
      row.quoteNumber,
      row.amount,
      row.kind,
      row.method,
      row.reference,
      row.recordedBy,
    ]),
  );
}

export function sittingCsv(rows: SittingRow[]) {
  return toCsv(
    ["staff", "role", "waiting_quotes", "pending_payments", "aging_orders"],
    rows.map((row) => [
      row.name,
      row.role,
      row.waitingQuotes,
      row.pendingPayments,
      row.agingOrders,
    ]),
  );
}

export function agingCsv(rows: AgingJob[]) {
  return toCsv(
    ["quote", "owner", "days_sitting", "status", "href"],
    rows.map((row) => [row.title, row.owner, row.days, row.status, row.href]),
  );
}
