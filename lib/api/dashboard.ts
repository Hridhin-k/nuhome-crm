import { cache } from "react";
import { listPendingPayments } from "@/lib/api/catalog";
import { listCustomers } from "@/lib/api/customers";
import { listOrders } from "@/lib/api/orders";
import { listPendingApprovals, listQuotes } from "@/lib/api/quotes";
import type { Accent } from "@/components/app/progress-bar";
import type { AppRole } from "@/lib/workflow/types";
import { ORDER_BUCKET_STATUSES } from "@/lib/workflow/status-buckets";
import { orderHasOverdueVendor } from "@/lib/workflow/fulfillment";

export type QueueCard = {
  title: string;
  count: number;
  href: string;
  detail: string;
  accent?: Accent;
  progress?: { value: number; max: number };
};

export type PipelineStage = {
  label: string;
  count: number;
  href: string;
  accent: Accent;
};

export type OperationsSnapshot = {
  open: number;
  customers: number;
  delivered: number;
  stages: PipelineStage[];
  queues: QueueCard[];
};

function overdueVendorCount(
  orders: { vendor_orders?: unknown }[],
) {
  return orders.filter((order) =>
    orderHasOverdueVendor(
      order.vendor_orders as
        | { status: string; expected_delivery_at?: string | null }[]
        | null,
    ),
  ).length;
}

function withAccents(cards: QueueCard[]): QueueCard[] {
  const cycle: Accent[] = ["cobalt", "violet", "forest", "cerulean"];
  return cards.map((card, index) => ({
    ...card,
    accent: card.accent ?? cycle[index % cycle.length],
  }));
}

export const getOperationsSnapshot = cache(async (): Promise<OperationsSnapshot> => {
  const [quotes, customers, orders, approvals, payments] = await Promise.all([
    listQuotes(),
    listCustomers(),
    listOrders(),
    listPendingApprovals(),
    listPendingPayments(),
  ]);

  const pendingQuotes = quotes.filter((q) =>
    ["quote_draft", "quote_rejected", "quote_approved"].includes(q.status),
  ).length;
  const active = orders.filter((o) =>
    (ORDER_BUCKET_STATUSES.active as readonly string[]).includes(o.status),
  ).length;
  const hold = orders.filter((o) =>
    (ORDER_BUCKET_STATUSES.hold as readonly string[]).includes(o.status),
  ).length;
  const deliveries = orders.filter((o) =>
    (ORDER_BUCKET_STATUSES.delivery as readonly string[]).includes(o.status),
  ).length;
  const overdue = overdueVendorCount(orders);
  const delivered = orders.filter((o) =>
    (ORDER_BUCKET_STATUSES.closed as readonly string[]).includes(o.status),
  ).length;

  const stages: PipelineStage[] = [
    { label: "Quotes in play", count: pendingQuotes, href: "/quotes", accent: "cobalt" },
    {
      label: "Awaiting accounts",
      count: approvals.length,
      href: "/approvals",
      accent: "violet",
    },
    {
      label: "Payments to verify",
      count: payments.length,
      href: "/payments",
      accent: "cerulean",
    },
    { label: "In fulfillment", count: active, href: "/orders?bucket=active", accent: "cobalt" },
    {
      label: "On hold",
      count: hold,
      href: "/orders?bucket=hold",
      accent: "violet",
    },
    { label: "Ready to deliver", count: deliveries, href: "/orders?bucket=delivery", accent: "forest" },
    { label: "Vendor overdue", count: overdue, href: "/orders?bucket=active", accent: "violet" },
  ];

  const open = stages.reduce((sum, stage) => sum + stage.count, 0);

  const queues = withAccents([
    {
      title: "Quotes awaiting approval",
      count: approvals.length,
      href: "/approvals",
      detail: "Selling price, discount, and margin",
      accent: "violet",
      progress: { value: approvals.length, max: Math.max(open, 1) },
    },
    {
      title: "Payments awaiting verification",
      count: payments.length,
      href: "/payments",
      detail: "Advance, full, or nil terms",
      accent: "cerulean",
      progress: { value: payments.length, max: Math.max(open, 1) },
    },
    {
      title: "Pending quotes",
      count: pendingQuotes,
      href: "/quotes",
      detail: "Drafts, returns, and approved quotes to send",
      accent: "cobalt",
      progress: { value: pendingQuotes, max: Math.max(open, 1) },
    },
    {
      title: "Active orders",
      count: active,
      href: "/orders?bucket=active",
      detail: "In fulfillment — not closed",
      accent: "forest",
      progress: { value: active, max: Math.max(open, 1) },
    },
    {
      title: "Orders on hold",
      count: hold,
      href: "/orders?bucket=hold",
      detail: "Delivery locked until payment",
      accent: "violet",
      progress: { value: hold, max: Math.max(open, 1) },
    },
    {
      title: "Vendor overdue",
      count: overdue,
      href: "/orders?bucket=active",
      detail: "Past expected delivery — still in transit or unsent",
      accent: "violet",
      progress: { value: overdue, max: Math.max(open, 1) },
    },
    {
      title: "Deliveries",
      count: deliveries,
      href: "/orders?bucket=delivery",
      detail: "Unlocked and ready to hand over",
      accent: "cerulean",
      progress: { value: deliveries, max: Math.max(open, 1) },
    },
  ]);

  return { open, customers: customers.length, delivered, stages, queues };
});

export const getHomeQueues = cache(async (role: AppRole): Promise<QueueCard[]> => {
  if (role === "admin") {
    const snapshot = await getOperationsSnapshot();
    return snapshot.queues;
  }

  if (role === "sales") {
    const [quotes, customers, orders] = await Promise.all([
      listQuotes(),
      listCustomers(),
      listOrders(),
    ]);
    const pendingQuotes = quotes.filter((q) =>
      ["quote_draft", "quote_rejected", "quote_approved"].includes(q.status),
    ).length;
    const active = orders.filter((o) =>
      (ORDER_BUCKET_STATUSES.active as readonly string[]).includes(o.status),
    ).length;
    const hold = orders.filter((o) =>
      (ORDER_BUCKET_STATUSES.hold as readonly string[]).includes(o.status),
    ).length;
    const deliveries = orders.filter((o) =>
      (ORDER_BUCKET_STATUSES.delivery as readonly string[]).includes(o.status),
    ).length;
    const overdue = overdueVendorCount(orders);
    const max = Math.max(pendingQuotes + active + hold + deliveries + overdue, 1);

    return withAccents([
      {
        title: "Pending quotes",
        count: pendingQuotes,
        href: "/quotes",
        detail: "Drafts, returns, and approved quotes to send",
        progress: { value: pendingQuotes, max },
      },
      {
        title: "Customers",
        count: customers.length,
        href: "/customers",
        detail: "Open a profile to quote or take payment",
      },
      {
        title: "Active orders",
        count: active,
        href: "/orders?bucket=active",
        detail: "In fulfillment — not closed",
        progress: { value: active, max },
      },
      {
        title: "Vendor overdue",
        count: overdue,
        href: "/orders?bucket=active",
        detail: "Past expected delivery",
        progress: { value: overdue, max },
      },
      {
        title: "Orders on hold",
        count: hold,
        href: "/orders?bucket=hold",
        detail: "Delivery locked until payment",
        progress: { value: hold, max },
      },
      {
        title: "Deliveries",
        count: deliveries,
        href: "/orders?bucket=delivery",
        detail: "Unlocked and ready to hand over",
        progress: { value: deliveries, max },
      },
    ]);
  }

  if (role === "accounts") {
    const [approvals, payments, orders] = await Promise.all([
      listPendingApprovals(),
      listPendingPayments(),
      listOrders([
        ...ORDER_BUCKET_STATUSES.payment,
        ...ORDER_BUCKET_STATUSES.hold,
      ]),
    ]);
    const max = Math.max(approvals.length + payments.length + orders.length, 1);
    return withAccents([
      {
        title: "Quotes awaiting approval",
        count: approvals.length,
        href: "/approvals",
        detail: "Review selling price, discount, and margin",
        progress: { value: approvals.length, max },
      },
      {
        title: "Payments awaiting verification",
        count: payments.length,
        href: "/payments",
        detail: "Confirm advance, full, or nil terms",
        progress: { value: payments.length, max },
      },
      {
        title: "Orders requiring attention",
        count: orders.length,
        href: "/orders?bucket=attention",
        detail: "Verification or on-hold balances",
        progress: { value: orders.length, max },
      },
    ]);
  }

  if (role === "procurement") {
    const orders = await listOrders([...ORDER_BUCKET_STATUSES.active]);
    const overdue = overdueVendorCount(orders);
    const max = Math.max(orders.length + overdue, 1);
    return withAccents([
      {
        title: "Awaiting vendor action",
        count: orders.filter((o) => o.status === "order_active").length,
        href: "/fulfillment",
        detail: "Active orders not yet sent",
        progress: {
          value: orders.filter((o) => o.status === "order_active").length,
          max,
        },
      },
      {
        title: "Vendor dispatches",
        count: orders.filter((o) => o.status === "sent_to_vendor").length,
        href: "/fulfillment",
        detail: "Waiting for dispatch",
        progress: {
          value: orders.filter((o) => o.status === "sent_to_vendor").length,
          max,
        },
      },
      {
        title: "Items expected",
        count: orders.filter((o) => o.status === "vendor_dispatched").length,
        href: "/fulfillment",
        detail: "In transit to store",
        progress: {
          value: orders.filter((o) => o.status === "vendor_dispatched").length,
          max,
        },
      },
      {
        title: "Vendor overdue",
        count: overdue,
        href: "/fulfillment",
        detail: "Past expected delivery — still sent or in transit",
        progress: { value: overdue, max },
      },
    ]);
  }

  const [gateOrders, activeOrders] = await Promise.all([
    listOrders([
      ...ORDER_BUCKET_STATUSES.delivery,
      ...ORDER_BUCKET_STATUSES.hold,
    ]),
    listOrders([...ORDER_BUCKET_STATUSES.active]),
  ]);
  const overdue = overdueVendorCount(activeOrders);
  const max = Math.max(gateOrders.length + overdue, 1);
  return withAccents([
    {
      title: "Ready for delivery",
      count: gateOrders.filter((o) => o.status === "delivery_unlocked").length,
      href: "/ready",
      detail: "Balance cleared — complete handover",
      progress: {
        value: gateOrders.filter((o) => o.status === "delivery_unlocked").length,
        max,
      },
    },
    {
      title: "Collect at handover",
      count: gateOrders.filter((o) =>
        (ORDER_BUCKET_STATUSES.hold as readonly string[]).includes(o.status),
      ).length,
      href: "/orders?bucket=hold",
      detail: "Take cash or UPI, then Accounts verifies",
      progress: {
        value: gateOrders.filter((o) =>
          (ORDER_BUCKET_STATUSES.hold as readonly string[]).includes(o.status),
        ).length,
        max,
      },
    },
    {
      title: "Vendor overdue",
      count: overdue,
      href: "/orders?bucket=active",
      detail: "Past expected delivery",
      progress: { value: overdue, max },
    },
  ]);
});
