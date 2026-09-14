import type { WorkflowStatus } from "@/lib/workflow/types";

export const JOB_STAGES = [
  { id: "quote", label: "Quote" },
  { id: "live", label: "Live" },
  { id: "production", label: "Factory" },
  { id: "ready", label: "Site" },
  { id: "done", label: "Done" },
] as const;

export type JobStageId = (typeof JOB_STAGES)[number]["id"] | "cancelled";

export type JobTrackId = "quote" | "money" | "factory" | "site";

export type JobTrackState = "idle" | "current" | "blocked" | "done";

export type JobTrack = {
  id: JobTrackId;
  label: string;
  state: JobTrackState;
  detail: string;
};

export function jobStage(status: WorkflowStatus): JobStageId {
  switch (status) {
    case "cancelled":
      return "cancelled";
    case "quote_draft":
    case "quote_pending_accounts":
    case "quote_rejected":
    case "quote_approved":
      return "quote";
    case "quote_sent_to_customer":
    case "payment_pending_verification":
    case "order_active":
      return "live";
    case "sent_to_vendor":
    case "vendor_dispatched":
      return "production";
    case "items_received":
    case "delivery_pending_payment":
    case "order_on_hold":
      return "ready";
    case "delivery_unlocked":
      return "ready";
    case "delivered":
    case "closed":
      return "done";
  }
}

export function jobStageLabel(status: WorkflowStatus) {
  const stage = jobStage(status);
  if (stage === "cancelled") return "Cancelled";
  return JOB_STAGES.find((row) => row.id === stage)?.label ?? "Quote";
}

const AFTER_QUOTE: WorkflowStatus[] = [
  "quote_sent_to_customer",
  "payment_pending_verification",
  "order_active",
  "sent_to_vendor",
  "vendor_dispatched",
  "items_received",
  "delivery_pending_payment",
  "order_on_hold",
  "delivery_unlocked",
  "delivered",
  "closed",
];

const IN_FACTORY: WorkflowStatus[] = [
  "sent_to_vendor",
  "vendor_dispatched",
  "items_received",
  "delivery_pending_payment",
  "order_on_hold",
  "delivery_unlocked",
  "delivered",
  "closed",
];

const FACTORY_DONE: WorkflowStatus[] = [
  "items_received",
  "delivery_pending_payment",
  "order_on_hold",
  "delivery_unlocked",
  "delivered",
  "closed",
];

export function jobTracks(input: {
  status: WorkflowStatus;
  outstanding?: number;
  paid?: number;
  hasPendingPayment?: boolean;
  hasUnsent?: boolean;
}): JobTrack[] {
  const status = input.status;
  const outstanding = input.outstanding ?? 0;
  const paid = input.paid ?? 0;
  const cancelled = status === "cancelled";

  const quoteDone = AFTER_QUOTE.includes(status);
  const quoteCurrent = !quoteDone && !cancelled;
  const quoteBlocked = status === "quote_pending_accounts" || status === "quote_rejected";

  let quoteDetail = "Draft the quote, then send it.";
  if (status === "quote_pending_accounts") {
    quoteDetail = "Waiting for Accounts to review.";
  } else if (status === "quote_rejected") {
    quoteDetail = "Revise and submit again.";
  } else if (status === "quote_approved") {
    quoteDetail = "Ready to send to the customer.";
  } else if (quoteDone) {
    quoteDetail = "Sent to the customer.";
  }

  const moneyIdle = !quoteDone;
  const moneyPending = status === "payment_pending_verification" || Boolean(input.hasPendingPayment);
  const moneyClear = quoteDone && outstanding <= 0 && paid > 0 && !moneyPending;
  const moneyDue = quoteDone && outstanding > 0;
  let moneyState: JobTrackState = "idle";
  let moneyDetail = "Starts after the quote is sent.";
  if (cancelled) {
    moneyState = "idle";
    moneyDetail = "Job cancelled.";
  } else if (moneyIdle) {
    moneyState = "idle";
  } else if (moneyPending) {
    moneyState = "current";
    moneyDetail = "Accounts is verifying a payment.";
  } else if (moneyDue) {
    moneyState = "blocked";
    moneyDetail = "Balance still due before handover.";
  } else if (moneyClear || (quoteDone && outstanding <= 0)) {
    moneyState = "done";
    moneyDetail =
      paid > 0 || outstanding <= 0
        ? "Customer money is clear."
        : "Nil terms recorded.";
  }

  const factoryStarted = IN_FACTORY.includes(status);
  const factoryDone = FACTORY_DONE.includes(status) && !input.hasUnsent;
  let factoryState: JobTrackState = "idle";
  let factoryDetail = "Starts when the order is live.";
  if (cancelled) {
    factoryDetail = "Job cancelled.";
  } else if (status === "order_active" || (factoryStarted && input.hasUnsent)) {
    factoryState = "current";
    factoryDetail = input.hasUnsent
      ? "Some lines still need a vendor."
      : "Allocate vendors and pay before dispatch.";
  } else if (status === "sent_to_vendor" || status === "vendor_dispatched") {
    factoryState = "current";
    factoryDetail =
      status === "vendor_dispatched"
        ? "Waiting for goods in."
        : "Vendor is making / shipping.";
  } else if (factoryDone) {
    factoryState = "done";
    factoryDetail = "Goods received.";
  } else if (!factoryStarted) {
    factoryState = "idle";
  }

  const siteUnlocked = status === "delivery_unlocked";
  const siteDone = status === "delivered" || status === "closed";
  const siteBlocked =
    outstanding > 0 &&
    (status === "items_received" ||
      status === "delivery_pending_payment" ||
      status === "order_on_hold");
  let siteState: JobTrackState = "idle";
  let siteDetail = "Handover after goods and money are clear.";
  if (cancelled) {
    siteDetail = "Job cancelled.";
  } else if (siteDone) {
    siteState = "done";
    siteDetail = status === "closed" ? "Closed." : "Delivered.";
  } else if (siteBlocked) {
    siteState = "blocked";
    siteDetail = "Delivery locked until the balance is verified or credit is approved.";
  } else if (siteUnlocked || (status === "items_received" && outstanding <= 0)) {
    siteState = "current";
    siteDetail = "Ready to deliver.";
  }

  return [
    {
      id: "quote",
      label: "Quote",
      state: cancelled
        ? "idle"
        : quoteDone
          ? "done"
          : quoteBlocked
            ? "blocked"
            : quoteCurrent
              ? "current"
              : "idle",
      detail: quoteDetail,
    },
    { id: "money", label: "Money", state: moneyState, detail: moneyDetail },
    { id: "factory", label: "Factory", state: factoryState, detail: factoryDetail },
    { id: "site", label: "Site", state: siteState, detail: siteDetail },
  ];
}
