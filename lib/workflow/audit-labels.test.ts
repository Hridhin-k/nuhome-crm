import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/workflow/types";
import {
  formatAuditEvent,
  groupAuditByDay,
  type AuditEvent,
} from "@/lib/workflow/audit-labels";
import { buildAuditRow } from "@/lib/workflow/audit";

function event(action: string, extra?: Partial<AuditEvent>): AuditEvent {
  return {
    id: "1",
    actor_id: "a",
    actor_role: "sales",
    actor_name: "Sales Demo",
    action,
    entity_type: "quote",
    entity_id: "q1",
    old_state: null,
    new_state: null,
    metadata: null,
    created_at: "2026-08-16T08:30:00.000Z",
    ...extra,
  };
}

describe("formatAuditEvent", () => {
  it("titles every known audit action", () => {
    for (const action of AUDIT_ACTIONS) {
      const formatted = formatAuditEvent(event(action));
      expect(formatted.title.length).toBeGreaterThan(0);
      expect(formatted.actor).toContain("Sales Demo");
    }
  });

  it("includes money, version, order number, and cancel reason in details", () => {
    expect(
      formatAuditEvent(event("PAYMENT_RECORDED", { metadata: { kind: "advance", amount: 5000 } }))
        .detail,
    ).toMatch(/advance/);
    expect(
      formatAuditEvent(event("PAYMENT_VERIFIED", { actor_role: "accounts", metadata: { amount: 5000 } }))
        .detail,
    ).toMatch(/verified by Accounts/);
    expect(
      formatAuditEvent(event("QUOTE_APPROVED", { metadata: { version: 3 } })).detail,
    ).toContain("Version 3");
    expect(
      formatAuditEvent(
        event("QUOTE_SENT_TO_CUSTOMER", { metadata: { order_number: "ORD-42" } }),
      ).detail,
    ).toContain("ORD-42");
    expect(
      formatAuditEvent(event("ORDER_CANCELLED", { metadata: { reason: "Customer dropped" } }))
        .detail,
    ).toContain("Customer dropped");
    expect(
      formatAuditEvent(event("QUOTE_CANCELLED", { metadata: { reason: "Wrong size" } })).detail,
    ).toContain("Wrong size");
  });

  it("falls back for an unknown action and labels a missing actor as System", () => {
    const formatted = formatAuditEvent(
      event("CUSTOM_PING", { actor_role: null, actor_name: "job", new_state: "order_active" }),
    );
    expect(formatted.title).toBe("custom ping");
    expect(formatted.actor).toBe("System · job");
    expect(formatted.detail).toContain("order active");
  });
});

describe("groupAuditByDay", () => {
  it("buckets events by calendar day", () => {
    const groups = groupAuditByDay([
      event("QUOTE_CREATED", { created_at: "2026-08-16T02:00:00.000Z" }),
      event("QUOTE_SUBMITTED", { id: "2", created_at: "2026-08-16T10:00:00.000Z" }),
      event("QUOTE_APPROVED", { id: "3", created_at: "2026-08-17T10:00:00.000Z" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].items).toHaveLength(1);
  });
});

describe("buildAuditRow", () => {
  it("nulls missing states and defaults metadata to {}", () => {
    expect(
      buildAuditRow({
        actorId: "a",
        actorRole: "admin",
        action: "PROFILE_UPDATED",
        entityType: "profile",
        entityId: "u1",
      }),
    ).toEqual({
      actor_id: "a",
      actor_role: "admin",
      action: "PROFILE_UPDATED",
      entity_type: "profile",
      entity_id: "u1",
      old_state: null,
      new_state: null,
      metadata: {},
    });
  });
});
