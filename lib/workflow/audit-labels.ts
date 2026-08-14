import type { AppRole, AuditAction } from "@/lib/workflow/types";
import { formatInrExact } from "@/lib/format/money";
import { roleLabel } from "@/lib/auth/nav";

export type AuditEvent = {
  id: string;
  actor_id: string | null;
  actor_role: AppRole | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_state: string | null;
  new_state: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_COPY: Record<
  string,
  { title: string; detail?: (event: AuditEvent) => string }
> = {
  QUOTE_CREATED: {
    title: "Quote created",
    detail: (e) =>
      e.metadata?.version
        ? `Version ${String(e.metadata.version)} created`
        : "Initial quote created",
  },
  QUOTE_SUBMITTED: {
    title: "Submitted to Accounts",
    detail: () => "Waiting for Accounts approval",
  },
  QUOTE_REJECTED: {
    title: "Quote returned to Sales",
    detail: () => "Accounts requested revisions",
  },
  QUOTE_REVISED: {
    title: "Quote revised",
    detail: (e) =>
      e.metadata?.version
        ? `Version ${String(e.metadata.version)} created by Sales`
        : "New version submitted",
  },
  QUOTE_APPROVED: {
    title: "Quote approved",
    detail: (e) =>
      e.metadata?.version
        ? `Version ${String(e.metadata.version)} approved by Accounts`
        : "Approved by Accounts",
  },
  QUOTE_SENT_TO_CUSTOMER: {
    title: "Quote sent to customer",
    detail: () => "Customer can review and confirm",
  },
  QUOTE_SHARED_VIA_WHATSAPP: {
    title: "Shared via WhatsApp",
    detail: () => "Quotation sent to the customer on WhatsApp",
  },
  ORDER_CREATED: {
    title: "Order created",
    detail: () => "Order opened from approved quote",
  },
  PAYMENT_RECORDED: {
    title: "Payment recorded",
    detail: (e) => {
      const kind = e.metadata?.kind ? String(e.metadata.kind) : "payment";
      const amount = e.metadata?.amount;
      return amount != null
        ? `${kind} ${formatInrExact(Number(amount))} recorded by Sales`
        : `${kind} payment recorded by Sales`;
    },
  },
  PAYMENT_VERIFIED: {
    title: "Payment verified",
    detail: (e) => {
      const amount = e.metadata?.amount;
      return amount != null
        ? `${formatInrExact(Number(amount))} verified by Accounts`
        : "Payment verified by Accounts";
    },
  },
  PAYMENT_REJECTED: {
    title: "Payment rejected",
    detail: () => "Accounts rejected the payment entry",
  },
  ORDER_ACTIVATED: {
    title: "Order activated",
    detail: () => "Fulfillment can begin",
  },
  ORDER_SENT_TO_VENDOR: {
    title: "Sent to vendor",
    detail: () => "Procurement placed the order with a vendor",
  },
  VENDOR_DISPATCHED: {
    title: "Vendor dispatched",
    detail: () => "Goods are in transit",
  },
  ITEMS_RECEIVED: {
    title: "Items received",
    detail: () => "Stock received at store",
  },
  ORDER_PLACED_ON_HOLD: {
    title: "Order placed on hold",
    detail: () => "Delivery locked until full payment",
  },
  DELIVERY_UNLOCKED: {
    title: "Delivery unlocked",
    detail: () => "Full payment verified — ready for handover",
  },
  ORDER_DELIVERED: {
    title: "Delivered to customer",
    detail: () => "Handover completed",
  },
  ORDER_CLOSED: {
    title: "Order closed",
    detail: () => "No further action required",
  },
  ROLE_CHANGED: {
    title: "Role changed",
    detail: (e) =>
      e.new_state ? `Role updated to ${e.new_state}` : "User role updated",
  },
  PROFILE_UPDATED: {
    title: "Staff profile updated",
    detail: (e) =>
      e.new_state ? `Status: ${e.new_state}` : "Profile updated",
  },
};

export function formatAuditEvent(event: AuditEvent) {
  const copy = ACTION_COPY[event.action] ?? {
    title: event.action.replaceAll("_", " ").toLowerCase(),
    detail: () =>
      event.new_state
        ? `Status: ${event.new_state.replaceAll("_", " ")}`
        : undefined,
  };
  const role = event.actor_role ? roleLabel(event.actor_role) : "System";
  return {
    title: copy.title,
    detail: copy.detail?.(event),
    actor: `${role} · ${event.actor_name}`,
    createdAt: event.created_at,
  };
}

export function groupAuditByDay(events: AuditEvent[]) {
  const groups = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const date = new Date(event.created_at);
    const key = date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
    const bucket = groups.get(key) ?? [];
    bucket.push(event);
    groups.set(key, bucket);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
