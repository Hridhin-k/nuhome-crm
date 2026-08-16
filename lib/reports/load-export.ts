import {
  getOperationsSnapshot,
  type OperationsSnapshot,
} from "@/lib/api/dashboard";
import {
  AUDIT_EXPORT_LIMIT,
  getBusinessReport,
  listAdminAudit,
  listCollections,
  type AgingJob,
  type BusinessReport,
  type CollectionRow,
  type SittingRow,
} from "@/lib/api/reports";
import type { AuditEvent } from "@/lib/workflow/audit-labels";

export const EXPORT_KINDS = [
  "audit",
  "floor",
  "collections",
  "sitting",
  "aging",
  "queues",
] as const;

export type ExportKind = (typeof EXPORT_KINDS)[number];

export type ExportQuery = {
  from: string;
  to: string;
  action?: string;
  q?: string;
};

export type ReportExport =
  | { kind: "audit"; from: string; to: string; events: AuditEvent[] }
  | { kind: "floor"; snapshot: OperationsSnapshot }
  | { kind: "queues"; snapshot: OperationsSnapshot }
  | { kind: "collections"; from: string; to: string; rows: CollectionRow[] }
  | { kind: "sitting"; from: string; to: string; rows: SittingRow[] }
  | { kind: "aging"; from: string; to: string; rows: AgingJob[] };

export function parseExportKind(value?: string | null): ExportKind | null {
  if (!value) return null;
  return (EXPORT_KINDS as readonly string[]).includes(value)
    ? (value as ExportKind)
    : null;
}

export async function loadReportExport(
  kind: ExportKind,
  query: ExportQuery,
): Promise<ReportExport> {
  if (kind === "audit") {
    const events = await listAdminAudit({ ...query, limit: AUDIT_EXPORT_LIMIT });
    return { kind, from: query.from, to: query.to, events };
  }

  if (kind === "floor" || kind === "queues") {
    const snapshot = await getOperationsSnapshot();
    return { kind, snapshot };
  }

  if (kind === "collections") {
    const rows = await listCollections(query.from, query.to);
    return { kind, from: query.from, to: query.to, rows };
  }

  const business: BusinessReport = await getBusinessReport(query.from, query.to);
  if (kind === "sitting") {
    return { kind, from: query.from, to: query.to, rows: business.sitting };
  }
  return { kind, from: query.from, to: query.to, rows: business.aging };
}
