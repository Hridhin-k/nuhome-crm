import { cache } from "react";
import { getDb } from "@/lib/api/db";
import { floorHref } from "@/lib/workflow/status-buckets";
import { WORKFLOW_STATUSES, type WorkflowStatus } from "@/lib/workflow/types";

export type FloorCounts = {
  quote_counts: Record<string, number>;
  order_counts: Record<string, number>;
  customers: number;
  pending_approvals: number;
  pending_payments: number;
  credit_requested: number;
  revision_pending: number;
  overdue_orders: number;
  vendor_quoted: number;
  catalog_users: number;
  catalog_vendors: number;
  catalog_materials: number;
};

function asInt(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, count]) => [
      key,
      asInt(count),
    ]),
  );
}

export const getFloorCounts = cache(async (): Promise<FloorCounts> => {
  const db = await getDb();
  const { data, error } = await db.rpc("floor_counts");
  if (error || data == null) {
    throw new Error(error?.message ?? "Failed to load floor counts");
  }
  const row = data as Record<string, unknown>;
  return {
    quote_counts: asMap(row.quote_counts),
    order_counts: asMap(row.order_counts),
    customers: asInt(row.customers),
    pending_approvals: asInt(row.pending_approvals),
    pending_payments: asInt(row.pending_payments),
    credit_requested: asInt(row.credit_requested),
    revision_pending: asInt(row.revision_pending),
    overdue_orders: asInt(row.overdue_orders),
    vendor_quoted: asInt(row.vendor_quoted),
    catalog_users: asInt(row.catalog_users),
    catalog_vendors: asInt(row.catalog_vendors),
    catalog_materials: asInt(row.catalog_materials),
  };
});

export function countForStatus(counts: FloorCounts, status: WorkflowStatus) {
  return counts.quote_counts[status] ?? counts.order_counts[status] ?? 0;
}

export function sumStatuses(counts: FloorCounts, statuses: readonly WorkflowStatus[]) {
  return statuses.reduce((sum, status) => sum + countForStatus(counts, status), 0);
}

export function censusFromCounts(counts: FloorCounts) {
  return WORKFLOW_STATUSES.map((status) => ({
    status,
    count: countForStatus(counts, status),
    href: floorHref(status),
  }));
}
