import { cache } from "react";
import { getFloorCounts, censusFromCounts, sumStatuses } from "@/lib/api/floor-counts";
import type { Accent } from "@/components/app/progress-bar";
import { liveJobCount } from "@/lib/workflow/home-counts";
import { ORDER_BUCKET_STATUSES, QUOTE_ONLY_STATUSES } from "@/lib/workflow/status-buckets";
import type { AppRole, WorkflowStatus } from "@/lib/workflow/types";

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
  stuck: number;
  creditRequested: number;
  asOf: string;
  census: StatusCensus[];
  stages: PipelineStage[];
  queues: QueueCard[];
};

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
  const counts = await getFloorCounts();
  const pendingQuotes = sumStatuses(counts, QUOTE_ONLY_STATUSES);
  const payment = sumStatuses(counts, ORDER_BUCKET_STATUSES.payment);
  const active = sumStatuses(counts, ORDER_BUCKET_STATUSES.active);
  const hold = sumStatuses(counts, ORDER_BUCKET_STATUSES.hold);
  const deliveries = sumStatuses(counts, ORDER_BUCKET_STATUSES.delivery);
  const overdue = counts.overdue_orders;
  const delivered = sumStatuses(counts, ["delivered", "closed"]);
  const census = censusFromCounts(counts);
  const open = liveJobCount(census);
  const stuck =
    counts.pending_approvals +
    counts.pending_payments +
    hold +
    overdue +
    counts.revision_pending +
    counts.credit_requested;

  const stages: PipelineStage[] = [
    {
      label: "Open quotes",
      count: pendingQuotes,
      href: "/quotes?group=quote",
      accent: "cobalt",
    },
    {
      label: "Awaiting accounts",
      count: counts.pending_approvals,
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
      count: counts.pending_payments,
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

  const workMax = Math.max(pendingQuotes, payment, active, hold, deliveries, overdue, 1);

  const queues = withAccents([
    {
      id: "approvals",
      title: "Quotes awaiting approval",
      count: counts.pending_approvals,
      href: "/approvals",
      detail: "Selling price, discount, and margin",
      accent: "violet",
      progress: scale(counts.pending_approvals, workMax),
    },
    {
      id: "payments",
      title: "Payments awaiting verification",
      count: counts.pending_payments,
      href: "/payments",
      detail: "Pending receipts — one per payment, not per job",
      accent: "cerulean",
      progress: scale(counts.pending_payments, workMax),
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
      id: "credit-delivery",
      title: "Credit delivery requests",
      kind: "flag",
      count: counts.credit_requested,
      href: "/orders?credit=1",
      detail: "Operations must approve handover without full payment",
      accent: "violet",
      progress: scale(counts.credit_requested, workMax),
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
    customers: counts.customers,
    delivered,
    pendingApprovals: counts.pending_approvals,
    pendingPayments: counts.pending_payments,
    overdue,
    stuck,
    creditRequested: counts.credit_requested,
    asOf: new Date().toISOString(),
    census,
    stages,
    queues,
  };
});

export const getHomeQueues = cache(async (role: AppRole): Promise<QueueCard[]> => {
  if (role === "admin" || role === "operations") {
    const snapshot = await getOperationsSnapshot();
    return snapshot.queues;
  }

  const counts = await getFloorCounts();

  if (role === "sales") {
    const pendingQuotes = sumStatuses(counts, QUOTE_ONLY_STATUSES);
    const payment = sumStatuses(counts, ORDER_BUCKET_STATUSES.payment);
    const active = sumStatuses(counts, ORDER_BUCKET_STATUSES.active);
    const hold = sumStatuses(counts, ORDER_BUCKET_STATUSES.hold);
    const deliveries = sumStatuses(counts, ORDER_BUCKET_STATUSES.delivery);
    const overdue = counts.overdue_orders;
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
        count: counts.customers,
        href: "/customers",
        detail: "Profiles on file — not open work",
        kind: "directory",
      },
    ]);
  }

  if (role === "accounts") {
    const awaiting = counts.order_counts.order_active ?? 0;
    const vendorQuotes = counts.vendor_quoted;
    const max = Math.max(
      counts.pending_approvals,
      counts.pending_payments,
      awaiting,
      vendorQuotes,
      1,
    );
    return withAccents([
      {
        id: "approvals",
        title: "Quotes awaiting approval",
        count: counts.pending_approvals,
        href: "/approvals",
        detail: "Review selling price, discount, and margin",
        progress: scale(counts.pending_approvals, max),
      },
      {
        id: "vendor-quotes",
        title: "Vendor quotes to verify",
        count: vendorQuotes,
        href: "/fulfillment",
        detail: "Vendor quote waiting for Accounts",
        progress: scale(vendorQuotes, max),
      },
      {
        id: "payments",
        title: "Payments awaiting verification",
        count: counts.pending_payments,
        href: "/payments",
        detail: "Pending receipts — one per payment, not per job",
        progress: scale(counts.pending_payments, max),
      },
      {
        id: "awaiting-vendor",
        title: "Awaiting vendor",
        count: awaiting,
        href: "/fulfillment",
        detail: "Active — send this to a vendor",
        progress: scale(awaiting, max),
      },
    ]);
  }

  if (role === "procurement") {
    const awaiting = counts.order_counts.order_active ?? 0;
    const dispatches = counts.order_counts.sent_to_vendor ?? 0;
    const expected = counts.order_counts.vendor_dispatched ?? 0;
    const received = counts.order_counts.items_received ?? 0;
    const overdue = counts.overdue_orders;
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

  const ready = counts.order_counts.delivery_unlocked ?? 0;
  const collect = sumStatuses(counts, ORDER_BUCKET_STATUSES.hold);
  const overdue = counts.overdue_orders;
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
