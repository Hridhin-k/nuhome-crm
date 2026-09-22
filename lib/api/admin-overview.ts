import { cache } from "react";
import { listMaterials, listProfiles, listVendors, profileRoles } from "@/lib/api/catalog";
import { getOperationsSnapshot } from "@/lib/api/dashboard";
import { getDb, throwQuery } from "@/lib/api/db";
import { listOrders } from "@/lib/api/orders";
import { listQuotes } from "@/lib/api/quotes";
import { rel, relList } from "@/lib/api/rel";
import { getBusinessReport } from "@/lib/api/reports";
import { inDateRange } from "@/lib/search";
import { isVendorOrderOverdue } from "@/lib/workflow/fulfillment";
import { isCompletedSaleStatus } from "@/lib/workflow/status-buckets";
import type { WorkflowStatus } from "@/lib/workflow/types";

export type SalesExecRow = {
  id: string;
  name: string;
  quotes: number;
  quoted: number;
  margin: number;
  activeOrders: number;
  delivered: number;
  collections: number;
};

export type CatalogHealth = {
  materialsActive: number;
  materialsInactive: number;
  materialsMissingCost: number;
  materialsMissingDescription: number;
  vendorsActive: number;
  vendorsInactive: number;
  vendorsMissingContact: number;
};

export type AdminCommandCenter = {
  from: string;
  to: string;
  collections: number;
  collectionCount: number;
  quoted: number;
  margin: number;
  delivered: number;
  open: number;
  stuck: number;
  overdue: number;
  creditRequested: number;
  vendor: {
    batches: number;
    onTime: number;
    late: number;
    overdueOpen: number;
  };
  sales: SalesExecRow[];
  catalog: CatalogHealth;
};

export function getAdminCommandCenter(from: string, to: string) {
  return getAdminCommandCenterCached(from, to);
}

const getAdminCommandCenterCached = cache(
  async (from: string, to: string): Promise<AdminCommandCenter> => {
    const db = await getDb();
    const [business, snapshot, orders, quotes, profiles, materials, vendors, payments] =
      await Promise.all([
        getBusinessReport(from, to),
        getOperationsSnapshot(),
        listOrders(),
        listQuotes(),
        listProfiles(),
        listMaterials({ includeInactive: true }),
        listVendors({ includeInactive: true }),
        throwQuery(
          db
            .from("payments")
            .select("id, amount, paid_at, status, order_id")
            .eq("status", "verified")
            .gte("paid_at", from)
            .lte("paid_at", to),
          "Failed to load sales collections",
        ),
      ]);

    const salesProfiles = profiles.filter(
      (profile) =>
        profile.is_active &&
        profileRoles(profile).some((role) => role === "sales" || role === "admin"),
    );
    const names = new Map(profiles.map((p) => [p.id, p.full_name || "Staff"]));

    const bySales = new Map<
      string,
      {
        quotes: number;
        quoted: number;
        margin: number;
        activeOrders: number;
        delivered: number;
        collections: number;
      }
    >();
    const ensure = (id: string) => {
      const row = bySales.get(id) ?? {
        quotes: 0,
        quoted: 0,
        margin: 0,
        activeOrders: 0,
        delivered: 0,
        collections: 0,
      };
      bySales.set(id, row);
      return row;
    };

    for (const quote of quotes) {
      if (!quote.created_by || !inDateRange(quote.created_at, from, to)) continue;
      const version = rel(quote.quote_versions);
      const row = ensure(quote.created_by);
      row.quotes += 1;
      row.quoted += Number(version?.total ?? 0);
      row.margin += Number(version?.margin_amount ?? 0);
    }

    for (const order of orders) {
      const salesId = order.assigned_sales_id;
      if (!salesId) continue;
      const status = order.status as WorkflowStatus;
      const row = ensure(salesId);
      if (isCompletedSaleStatus(status) && inDateRange(order.updated_at, from, to)) {
        row.delivered += 1;
      } else if (
        status !== "cancelled" &&
        status !== "closed" &&
        status !== "delivered"
      ) {
        row.activeOrders += 1;
      }
    }

    const orderSales = new Map(
      orders.map((order) => [order.id, order.assigned_sales_id as string | null]),
    );
    for (const payment of payments) {
      const salesId = payment.order_id
        ? orderSales.get(payment.order_id)
        : null;
      if (!salesId) continue;
      ensure(salesId).collections += Number(payment.amount ?? 0);
    }

    const sales: SalesExecRow[] = salesProfiles
      .map((profile) => {
        const counts = bySales.get(profile.id) ?? {
          quotes: 0,
          quoted: 0,
          margin: 0,
          activeOrders: 0,
          delivered: 0,
          collections: 0,
        };
        return {
          id: profile.id,
          name: names.get(profile.id) || profile.full_name || "Staff",
          ...counts,
        };
      })
      .filter(
        (row) =>
          row.quotes > 0 ||
          row.activeOrders > 0 ||
          row.delivered > 0 ||
          row.collections > 0,
      )
      .sort(
        (a, b) =>
          b.collections + b.margin - (a.collections + a.margin) ||
          b.quoted - a.quoted,
      );

    let materialsMissingCost = 0;
    let materialsMissingDescription = 0;
    let materialsActive = 0;
    let materialsInactive = 0;
    for (const material of materials) {
      if (material.is_active) materialsActive += 1;
      else materialsInactive += 1;
      if (!(Number(material.default_cost) > 0)) materialsMissingCost += 1;
      if (!material.description?.trim()) materialsMissingDescription += 1;
    }

    let vendorsActive = 0;
    let vendorsInactive = 0;
    let vendorsMissingContact = 0;
    for (const vendor of vendors) {
      if (vendor.is_active) vendorsActive += 1;
      else vendorsInactive += 1;
      const contacts = relList(vendor.vendor_contacts);
      if (!vendor.phone && !vendor.email && contacts.length === 0) {
        vendorsMissingContact += 1;
      }
    }

    // Touch overdue open from live floor (not only date-range SLA).
    let liveOverdue = 0;
    for (const order of orders) {
      for (const batch of relList(
        order.vendor_orders as
          | {
              status: string;
              expected_delivery_at?: string | null;
            }[]
          | null,
      )) {
        if (
          isVendorOrderOverdue({
            status: batch.status,
            expected_delivery_at: batch.expected_delivery_at ?? null,
          })
        ) {
          liveOverdue += 1;
        }
      }
    }

    return {
      from,
      to,
      collections: business.collections,
      collectionCount: business.collectionCount,
      quoted: business.quoted,
      margin: business.margin,
      delivered: business.delivered,
      open: snapshot.open,
      stuck: snapshot.stuck,
      overdue: Math.max(snapshot.overdue, liveOverdue),
      creditRequested: snapshot.creditRequested,
      vendor: business.vendor,
      sales,
      catalog: {
        materialsActive,
        materialsInactive,
        materialsMissingCost,
        materialsMissingDescription,
        vendorsActive,
        vendorsInactive,
        vendorsMissingContact,
      },
    };
  },
);
