import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { listOrders } from "@/lib/api/orders";
import { listQuotes } from "@/lib/api/quotes";
import { listProfiles, profileRoles } from "@/lib/api/catalog";
import { rel, relList } from "@/lib/api/rel";
import { roleLabels } from "@/lib/auth/nav";
import { daysSitting, inDateRange, matchesSearch, rangeToIso } from "@/lib/search";
import type { AuditEvent } from "@/lib/workflow/audit-labels";
import { isVendorOrderOverdue } from "@/lib/workflow/fulfillment";
import { isClosedOrderStatus, isCompletedSaleStatus } from "@/lib/workflow/status-buckets";
import type { AppRole, WorkflowStatus } from "@/lib/workflow/types";

export type SittingRow = {
  id: string;
  name: string;
  role: string;
  waitingQuotes: number;
  pendingPayments: number;
  agingOrders: number;
};

export type AgingJob = {
  id: string;
  href: string;
  title: string;
  owner: string;
  days: number;
  status: WorkflowStatus;
};

export type VendorSla = {
  batches: number;
  onTime: number;
  late: number;
  overdueOpen: number;
};

export type BusinessReport = {
  from: string;
  to: string;
  collections: number;
  collectionCount: number;
  quoted: number;
  margin: number;
  delivered: number;
  vendor: VendorSla;
  sitting: SittingRow[];
  aging: AgingJob[];
};

export function getBusinessReport(from: string, to: string) {
  return getBusinessReportCached(from, to);
}

const getBusinessReportCached = cache(
  async (from: string, to: string): Promise<BusinessReport> => {
    const db = await getDb();
    const [orders, quotes, profiles, payments, pendingPay] = await Promise.all([
      listOrders(),
      listQuotes(),
      listProfiles(),
      throwQuery(
        db
          .from("payments")
          .select("id, amount, paid_at, status, recorded_by, order_id")
          .eq("status", "verified")
          .gte("paid_at", from)
          .lte("paid_at", to),
        "Failed to load collections",
      ),
      throwQuery(
        db
          .from("payments")
          .select("id, recorded_by, order_id, status")
          .eq("status", "pending"),
        "Failed to load pending payments",
      ),
    ]);

    const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));
    const nameOf = (id: string | null | undefined) =>
      (id ? names.get(id) : null) ?? "Unassigned";

    const collections = payments.reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    );

    let quoted = 0;
    let margin = 0;
    for (const quote of quotes) {
      if (!inDateRange(quote.created_at, from, to)) continue;
      const version = rel(quote.quote_versions);
      quoted += Number(version?.total ?? 0);
      margin += Number(version?.margin_amount ?? 0);
    }

    const delivered = orders.filter(
      (order) =>
        isCompletedSaleStatus(order.status as WorkflowStatus) &&
        inDateRange(order.updated_at, from, to),
    ).length;

    let batches = 0;
    let onTime = 0;
    let late = 0;
    let overdueOpen = 0;
    for (const order of orders) {
      for (const batch of relList(
        order.vendor_orders as
          | {
              status: string;
              expected_delivery_at?: string | null;
              received_at?: string | null;
            }[]
          | null,
      )) {
        const expectedAt = batch.expected_delivery_at ?? null;
        const overdue = isVendorOrderOverdue({
          status: batch.status,
          expected_delivery_at: expectedAt,
        });
        const relevant =
          inDateRange(batch.received_at, from, to) ||
          inDateRange(expectedAt, from, to) ||
          overdue;
        if (!relevant) continue;
        batches += 1;
        const expected = expectedAt?.slice(0, 10);
        const received = batch.received_at?.slice(0, 10) ?? null;
        if (received && expected) {
          if (received <= expected) onTime += 1;
          else late += 1;
        } else if (overdue) {
          overdueOpen += 1;
        }
      }
    }

    const sittingMap = new Map<
      string,
      { waitingQuotes: number; pendingPayments: number; agingOrders: number }
    >();
    const bump = (
      id: string | null | undefined,
      field: "waitingQuotes" | "pendingPayments" | "agingOrders",
    ) => {
      const key = id ?? "none";
      const row = sittingMap.get(key) ?? {
        waitingQuotes: 0,
        pendingPayments: 0,
        agingOrders: 0,
      };
      row[field] += 1;
      sittingMap.set(key, row);
    };

    for (const quote of quotes) {
      if (
        quote.status === "quote_draft" ||
        quote.status === "quote_rejected" ||
        quote.status === "quote_approved" ||
        quote.status === "quote_pending_accounts"
      ) {
        bump(quote.created_by, "waitingQuotes");
      }
    }
    for (const payment of pendingPay) {
      const order = orders.find((row) => row.id === payment.order_id);
      bump(order?.assigned_sales_id ?? payment.recorded_by, "pendingPayments");
    }

    const aging: AgingJob[] = [];
    for (const order of orders) {
      const status = order.status as WorkflowStatus;
      if (isClosedOrderStatus(status)) continue;
      const days = daysSitting(order.updated_at);
      if (days < 3) continue;
      bump(order.assigned_sales_id, "agingOrders");
      const quote = rel(order.quotes);
      aging.push({
        id: order.id,
        href: `/orders/${order.id}`,
        title: quote?.quote_number ?? "Order",
        owner: nameOf(order.assigned_sales_id),
        days,
        status,
      });
    }
    aging.sort((a, b) => b.days - a.days);

    const sitting: SittingRow[] = profiles
      .filter((profile) => profile.is_active)
      .map((profile) => {
        const counts = sittingMap.get(profile.id) ?? {
          waitingQuotes: 0,
          pendingPayments: 0,
          agingOrders: 0,
        };
        return {
          id: profile.id,
          name: profile.full_name || "Staff",
          role: roleLabels(profileRoles(profile)),
          ...counts,
        };
      })
      .filter(
        (row) =>
          row.waitingQuotes > 0 ||
          row.pendingPayments > 0 ||
          row.agingOrders > 0,
      )
      .sort(
        (a, b) =>
          b.waitingQuotes +
          b.pendingPayments +
          b.agingOrders -
          (a.waitingQuotes + a.pendingPayments + a.agingOrders),
      );

    return {
      from,
      to,
      collections,
      collectionCount: payments.length,
      quoted,
      margin,
      delivered,
      vendor: { batches, onTime, late, overdueOpen },
      sitting,
      aging,
    };
  },
);

export type CollectionRow = {
  id: string;
  paidAt: string;
  amount: number;
  kind: string;
  method: string;
  reference: string;
  quoteNumber: string;
  recordedBy: string;
};

export function listCollections(from: string, to: string) {
  return listCollectionsCached(`${from}|${to}`);
}

const listCollectionsCached = cache(async (key: string): Promise<CollectionRow[]> => {
  const [from, to] = key.split("|");
  const db = await getDb();
  const [payments, orders, profiles] = await Promise.all([
    throwQuery(
      db
        .from("payments")
        .select("id, amount, paid_at, kind, method, reference_number, recorded_by, order_id")
        .eq("status", "verified")
        .gte("paid_at", from)
        .lte("paid_at", to)
        .order("paid_at", { ascending: false }),
      "Failed to load collections",
    ),
    listOrders(),
    listProfiles(),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));
  const quoteByOrder = new Map(
    orders.map((order) => [order.id, rel(order.quotes)?.quote_number ?? ""]),
  );
  return payments.map((row) => ({
    id: row.id,
    paidAt: row.paid_at,
    amount: Number(row.amount ?? 0),
    kind: row.kind,
    method: row.method ?? "",
    reference: row.reference_number ?? "",
    quoteNumber: (row.order_id ? quoteByOrder.get(row.order_id) : null) ?? "",
    recordedBy: names.get(row.recorded_by) ?? "Staff",
  }));
});

function mapAuditRow(
  row: {
    id: string;
    actor_id: string | null;
    actor_role: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    old_state: string | null;
    new_state: string | null;
    metadata: unknown;
    created_at: string;
  },
  names: Map<string, string>,
): AuditEvent {
  return {
    id: row.id,
    actor_id: row.actor_id,
    actor_role: row.actor_role as AppRole | null,
    actor_name: (row.actor_id ? names.get(row.actor_id) : null) ?? "Someone",
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_state: row.old_state,
    new_state: row.new_state,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
  };
}

export const AUDIT_EXPORT_LIMIT = 2000;
export const AUDIT_PAGE_LIMIT = 200;

export function listAdminAudit(input: {
  from: string;
  to: string;
  action?: string;
  q?: string;
  limit?: number;
}) {
  const limit = input.limit ?? AUDIT_PAGE_LIMIT;
  return listAdminAuditCached(
    `${input.from}|${input.to}|${input.action ?? ""}|${input.q ?? ""}|${limit}`,
  );
}

export function listRecentAudit(limit = 12) {
  return listRecentAuditCached(limit);
}

const listRecentAuditCached = cache(async (limit: number): Promise<AuditEvent[]> => {
  const db = await getDb();
  const [rows, profiles] = await Promise.all([
    throwQuery(
      db
        .from("audit_logs")
        .select(
          "id, actor_id, actor_role, action, entity_type, entity_id, old_state, new_state, metadata, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(limit),
      "Failed to load audit",
    ),
    listProfiles(),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));
  return rows.map((row) => mapAuditRow(row, names));
});

const listAdminAuditCached = cache(async (key: string): Promise<AuditEvent[]> => {
  const [from, to, action, q, limitRaw] = key.split("|");
  const { start, end } = rangeToIso(from, to);
  const db = await getDb();
  let request = db
    .from("audit_logs")
    .select(
      "id, actor_id, actor_role, action, entity_type, entity_id, old_state, new_state, metadata, created_at",
    )
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: false })
    .limit(Number(limitRaw) || AUDIT_PAGE_LIMIT);

  if (action) {
    request = request.eq("action", action);
  }

  const [rows, profiles] = await Promise.all([
    throwQuery(request, "Failed to load audit"),
    listProfiles(),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));

  return rows
    .map((row) => mapAuditRow(row, names))
    .filter((event) =>
      matchesSearch(
        [event.actor_name, event.action, event.entity_type, event.old_state, event.new_state],
        q,
      ),
    );
});
