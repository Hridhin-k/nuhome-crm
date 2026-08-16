import { describe, expect, it } from "vitest";
import {
  WORKFLOW_TRANSITIONS,
  assertTransition,
  canSendQuoteToCustomer,
  canTransition,
} from "@/lib/workflow/transitions";
import { assertOrderTransition, assertQuoteTransition } from "@/lib/workflow/compat";
import { WORKFLOW_STATUSES, type WorkflowStatus } from "@/lib/workflow/types";

describe("workflow transition table", () => {
  it("lists every status exactly once as a from-state", () => {
    expect(Object.keys(WORKFLOW_TRANSITIONS).sort()).toEqual(
      [...WORKFLOW_STATUSES].sort(),
    );
  });

  it("allows only the canonical edges and rejects every other pair", () => {
    let allowed = 0;
    let blocked = 0;
    for (const from of WORKFLOW_STATUSES) {
      for (const to of WORKFLOW_STATUSES) {
        const ok = WORKFLOW_TRANSITIONS[from].includes(to);
        expect(canTransition(from, to)).toBe(ok);
        if (ok) {
          expect(() => assertTransition(from, to)).not.toThrow();
          allowed += 1;
        } else {
          expect(() => assertTransition(from, to)).toThrow(
            `Invalid transition: ${from} → ${to}`,
          );
          blocked += 1;
        }
      }
    }
    expect(allowed + blocked).toBe(WORKFLOW_STATUSES.length ** 2);
    expect(allowed).toBeGreaterThan(0);
    expect(blocked).toBeGreaterThan(allowed);
  });

  it("has no self-transitions and terminal closed/cancelled states", () => {
    for (const status of WORKFLOW_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
    expect(WORKFLOW_TRANSITIONS.closed).toEqual([]);
    expect(WORKFLOW_TRANSITIONS.cancelled).toEqual([]);
    expect(WORKFLOW_TRANSITIONS.delivered).toEqual(["closed"]);
  });

  it("only sends an approved quote to the customer", () => {
    for (const status of WORKFLOW_STATUSES) {
      expect(canSendQuoteToCustomer(status)).toBe(status === "quote_approved");
    }
  });

  it("keeps quote and order wrappers in sync with the table", () => {
    expect(() => assertQuoteTransition("quote_draft", "quote_pending_accounts")).not.toThrow();
    expect(() => assertQuoteTransition("quote_draft", "quote_approved")).toThrow();
    expect(() => assertOrderTransition("order_active", "sent_to_vendor")).not.toThrow();
    expect(() => assertOrderTransition("order_active", "delivered")).toThrow();
  });

  it("can cancel from every live status and never from delivered/closed/cancelled", () => {
    const live: WorkflowStatus[] = WORKFLOW_STATUSES.filter(
      (status) => status !== "delivered" && status !== "closed" && status !== "cancelled",
    );
    for (const status of live) {
      expect(canTransition(status, "cancelled")).toBe(true);
    }
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("closed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "cancelled")).toBe(false);
  });
});
