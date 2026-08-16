import { cache } from "react";
import { listPendingPayments } from "@/lib/api/catalog";
import { listCustomers } from "@/lib/api/customers";
import { listOrders } from "@/lib/api/orders";
import { listPendingApprovals, listQuotes } from "@/lib/api/quotes";
import type { Accent } from "@/components/app/progress-bar";
import { WORKFLOW_STATUSES, type AppRole, type WorkflowStatus } from "@/lib/workflow/types";
import {
  completedOrderCount,
  liveJobCount,
  liveStatus,
  openQuoteCount,
  ordersInBucket,
  ordersWithStatus,
} from "@/lib/workflow/home-counts";
import { floorHref, ORDER_BUCKET_STATUSES } from "@/lib/workflow/status-buckets";
import { orderHasOverdueVendor } from "@/lib/workflow/fulfillment";

export type QueueCard = {
  id: string;
  title: string;
  count: number;
  href: string;
  detail: string;
  accent?: Accent;
  progress?: { value: number; max: number };
  kind?: "queue" | "directory" | "flag";
};

export type PipelineStage = {
  label: string;
  count: number;
  href: string;
  accent: Accent;
};

export type StatusCensus = {
  status: WorkflowStatus;
  count: number;
  href: string;
};

export type OperationsSnapshot = {
  open: number;
  customers: number;
  delivered: number;
  pendingApprovals: number;
  pendingPayments: number;
  overdue: number;
  asOf: string;
  census: StatusCensus[];
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

function scale(value: number, max: number) {
  return { value, max: Math.max(max, 1) };
}

export const getOperationsSnapshot = cache(async (): Promise<OperationsSnapshot> => {
  const [quotes, customers, orders, approvals, payments] = await Promise.all([
    listQuotes(),
    listCustomers(),
    listOrders(),
    listPendingApprovals(),
    listPendingPayments(),
  ]);

  const pendingQuotes = openQuoteCount(quotes);
  const payment = ordersInBucket(orders, "payment");
  const active = ordersInBucket(orders, "active");
  const hold = ordersInBucket(orders, "hold");
  const deliveries = ordersInBucket(orders, "delivery");
  const overdue = overdueVendorCount(orders);
  const delivered = completedOrderCount(orders);

  const censusCounts = Object.fromEntries(
    WORKFLOW_STATUSES.map((status) => [status, 0]),
  ) as Record<WorkflowStatus, number>;
  for (const quote of quotes) {
    censusCounts[liveStatus(quote)] += 1;
  }
  const census: StatusCensus[] = WORKFLOW_STATUSES.map((status) => ({
    status,
    count: censusCounts[status],
    href: floorHref(status),
  }));
  const open = liveJobCount(census);

  const stages: PipelineStage[] = [
    {
      label: "Open quotes",
      count: pendingQuotes,
      href: "/quotes?group=quote",
      accent: "cobalt",
    },
    {
      label: "Awaiting accounts",
      count: approvals.length,
      href: "/approvals",
      accent: "violet",
    },
    {
      label: "Payment",
      count: payment,
      href: "/orders?bucket=payment",
      accent: "cerulean",
    },
    {
      label: "Payments to verify",
      count: payments.length,
      href: "/payments",
      accent: "cerulean",
    },
    {
      label: "In fulfillment",
      count: active,
      href: "/orders?bucket=active",
      accent: "cobalt",
    },
    {
      label: "On hold",
      count: hold,
      href: "/orders?bucket=hold",
      accent: "violet",
    },
    {
      label: "Ready to deliver",
      count: deliveries,
      href: "/orders?bucket=delivery",
      accent: "forest",
    },
  ];

  const workMax = Math.max(
    pendingQuotes,
    payment,
    active,
    hold,
    deliveries,
    overdue,
    1,
  );

  const queues = withAccents([
    {
      id: "approvals",
      title: "Quotes awaiting approval",
      count: approvals.length,
      href: "/approvals",
      detail: "Selling price, discount, and margin",
      accent: "violet",
      progress: scale(approvals.length, workMax),
    },
    {
      id: "payments",
      title: "Payments awaiting verification",
      count: payments.length,
      href: "/payments",
      detail: "Pending receipts — one per payment, not per job",
      accent: "cerulean",
      progress: scale(payments.length, workMax),
    },
    {
      id: "pending-quotes",
      title: "Open quotes",
      count: pendingQuotes,
      href: "/quotes?group=quote",
      detail: "Drafts, Accounts review, returns, and approved quotes to send",
      accent: "cobalt",
      progress: scale(pendingQuotes, workMax),
    },
    {
      id: "payment",
      title: "Awaiting payment",
      count: payment,
      href: "/orders?bucket=payment",
      detail: "Sent — record payment or wait for Accounts",
      accent: "cerulean",
      progress: scale(payment, workMax),
    },
    {
      id: "active-orders",
      title: "Active orders",
      count: active,
      href: "/orders?bucket=active",
      detail: "With vendor or at store",
      accent: "forest",
      progress: scale(active, workMax),
    },
    {
      id: "orders-on-hold",
      title: "Orders on hold",
      count: hold,
      href: "/orders?bucket=hold",
      detail: "Delivery locked until the balance is verified",
      accent: "violet",
      progress: scale(hold, workMax),
    },
    {
      id: "vendor-overdue",
      title: "Vendor overdue",
      kind: "flag",
      count: overdue,
      href: "/fulfillment",
      detail: "Expected date passed — still sent or in transit",
      accent: "violet",
      progress: scale(overdue, workMax),
    },
    {
      id: "deliveries",
      title: "Ready to deliver",
      count: deliveries,
      href: "/orders?bucket=delivery",
      detail: "Unlocked — outstanding is zero",
      accent: "cerulean",
      progress: scale(deliveries, workMax),
    },
  ]);

  return {
    open,
    customers: customers.length,
    delivered,
    pendingApprovals: approvals.length,
    pendingPayments: payments.length,
    overdue,
    asOf: new Date().toISOString(),
    census,
    stages,
    queues,
  };
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
    const pendingQuotes = openQuoteCount(quotes);
    const payment = ordersInBucket(orders, "payment");
    const active = ordersInBucket(orders, "active");
    const hold = ordersInBucket(orders, "hold");
    const deliveries = ordersInBucket(orders, "delivery");
    const overdue = overdueVendorCount(orders);
    const max = Math.max(pendingQuotes, payment, active, hold, deliveries, overdue, 1);

    return withAccents([
      {
        id: "pending-quotes",
        title: "Open quotes",
        count: pendingQuotes,
        href: "/quotes?group=quote",
        detail: "Drafts, Accounts review, returns, and approved quotes to send",
        progress: scale(pendingQuotes, max),
      },
      {
        id: "payment",
        title: "Awaiting payment",
        count: payment,
        href: "/orders?bucket=payment",
        detail: "Sent — record payment or wait for Accounts to verify",
        progress: scale(payment, max),
      },
      {
        id: "active-orders",
        title: "Active orders",
        count: active,
        href: "/orders?bucket=active",
        detail: "With vendor or at store",
        progress: scale(active, max),
      },
      {
        id: "vendor-overdue",
        title: "Vendor overdue",
        kind: "flag",
        count: overdue,
        href: "/orders?bucket=active",
        detail: "Expected date passed — still sent or in transit",
        progress: scale(overdue, max),
      },
      {
        id: "orders-on-hold",
        title: "Orders on hold",
        count: hold,
        href: "/orders?bucket=hold",
        detail: "Delivery locked until the balance is verified",
        progress: scale(hold, max),
      },
      {
        id: "deliveries",
        title: "Ready to deliver",
        count: deliveries,
        href: "/orders?bucket=delivery",
        detail: "Unlocked — outstanding is zero",
        progress: scale(deliveries, max),
      },
      {
        id: "customers",
        title: "Customers",
        count: customers.length,
        href: "/customers",
        detail: "Profiles on file — not open work",
        kind: "directory",
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
    const max = Math.max(approvals.length, payments.length, orders.length, 1);
    return withAccents([
      {
        id: "approvals",
        title: "Quotes awaiting approval",
        count: approvals.length,
        href: "/approvals",
        detail: "Review selling price, discount, and margin",
        progress: scale(approvals.length, max),
      },
      {
        id: "payments",
        title: "Payments awaiting verification",
        count: payments.length,
        href: "/payments",
        detail: "Pending receipts — one per payment, not per job",
        progress: scale(payments.length, max),
      },
      {
        id: "attention",
        title: "Orders requiring attention",
        count: orders.length,
        href: "/orders?bucket=attention",
        detail: "Sent, verify-pay, or on-hold balances",
        progress: scale(orders.length, max),
      },
    ]);
  }

  if (role === "procurement") {
    const orders = await listOrders([...ORDER_BUCKET_STATUSES.active]);
    const awaiting = ordersWithStatus(orders, "order_active");
    const dispatches = ordersWithStatus(orders, "sent_to_vendor");
    const expected = ordersWithStatus(orders, "vendor_dispatched");
    const received = ordersWithStatus(orders, "items_received");
    const overdue = overdueVendorCount(orders);
    const max = Math.max(awaiting, dispatches, expected, received, overdue, 1);
    return withAccents([
      {
        id: "awaiting-vendor",
        title: "Awaiting vendor",
        count: awaiting,
        href: "/fulfillment",
        detail: "Active — not sent to a vendor yet",
        progress: scale(awaiting, max),
      },
      {
        id: "vendor-dispatches",
        title: "Awaiting dispatch",
        count: dispatches,
        href: "/fulfillment",
        detail: "Sent — waiting for the vendor to dispatch",
        progress: scale(dispatches, max),
      },
      {
        id: "items-expected",
        title: "In transit",
        count: expected,
        href: "/fulfillment",
        detail: "Dispatched — goods coming to store",
        progress: scale(expected, max),
      },
      {
        id: "items-received",
        title: "Received",
        count: received,
        href: "/fulfillment",
        detail: "At store — close remainder or wait for delivery gate",
        progress: scale(received, max),
      },
      {
        id: "vendor-overdue",
        title: "Vendor overdue",
        kind: "flag",
        count: overdue,
        href: "/fulfillment",
        detail: "Expected date passed — still sent or in transit",
        progress: scale(overdue, max),
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
  const ready = ordersWithStatus(gateOrders, "delivery_unlocked");
  const collect = ordersInBucket(gateOrders, "hold");
  const overdue = overdueVendorCount(activeOrders);
  const max = Math.max(ready, collect, overdue, 1);
  return withAccents([
    {
      id: "ready-delivery",
      title: "Ready for delivery",
      count: ready,
      href: "/ready",
      detail: "Balance cleared — complete handover",
      progress: scale(ready, max),
    },
    {
      id: "collect-handover",
      title: "Collect at handover",
      count: collect,
      href: "/orders?bucket=hold",
      detail: "Take cash or UPI, then Accounts verifies",
      progress: scale(collect, max),
    },
    {
      id: "vendor-overdue",
      title: "Vendor overdue",
      kind: "flag",
      count: overdue,
      href: "/orders?bucket=active",
      detail: "Expected date passed — still sent or in transit",
      progress: scale(overdue, max),
    },
  ]);
});

export async function getHomeQueuesForRoles(roles: AppRole[]) {
  if (roles.includes("admin")) {
    return getHomeQueues("admin");
  }
  const unique = [...new Set(roles)];
  const groups = await Promise.all(unique.map((role) => getHomeQueues(role)));
  const seen = new Set<string>();
  const merged: QueueCard[] = [];
  for (const group of groups) {
    for (const card of group) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      merged.push(card);
    }
  }
  return merged;
}

export function cardById(queues: QueueCard[], id: string) {
  return queues.find((card) => card.id === id);
}
