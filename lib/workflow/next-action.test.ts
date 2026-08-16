import { describe, expect, it } from "vitest";
import { nextRequiredAction } from "@/lib/workflow/next-action";
import { WORKFLOW_STATUSES, type AppRole, type WorkflowStatus } from "@/lib/workflow/types";

const ROLES: AppRole[] = ["sales", "accounts", "procurement", "store", "admin"];
const Q = "quote-1";
const O = "order-1";

function action(
  status: WorkflowStatus,
  role: AppRole,
  extra?: Partial<Parameters<typeof nextRequiredAction>[0]>,
) {
  return nextRequiredAction({
    status,
    role,
    quoteId: Q,
    orderId: O,
    outstanding: 0,
    ...extra,
  });
}

describe("nextRequiredAction for every status and role", () => {
  it("returns a title and detail for every status × role combination", () => {
    for (const status of WORKFLOW_STATUSES) {
      for (const role of ROLES) {
        const result = action(status, role);
        expect(result.title.length).toBeGreaterThan(0);
        expect(result.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives Sales the draft / send / record CTAs and hides Accounts ones", () => {
    expect(action("quote_draft", "sales").cta).toBe("Edit draft");
    expect(action("quote_draft", "accounts").cta).toBeUndefined();
    expect(action("quote_rejected", "sales").cta).toBe("Revise");
    expect(action("quote_approved", "sales").cta).toBe("Send");
    expect(action("quote_approved", "accounts").cta).toBeUndefined();
    expect(
      action("quote_sent_to_customer", "sales", { payments: [] }).cta,
    ).toBe("Record payment");
    expect(
      action("quote_sent_to_customer", "accounts", { payments: [] }).cta,
    ).toBeUndefined();
  });

  it("gives Accounts the review CTAs on pending quote and payment", () => {
    expect(action("quote_pending_accounts", "accounts").cta).toBe("Review");
    expect(action("quote_pending_accounts", "accounts").href).toBe(`/quotes/${Q}`);
    expect(action("quote_pending_accounts", "sales").cta).toBeUndefined();
    expect(action("quote_pending_accounts", "sales").title).toMatch(/Waiting for Accounts/);
    expect(
      action("payment_pending_verification", "accounts", {
        payments: [{ status: "pending" }],
      }).cta,
    ).toBe("Review");
    expect(
      action("payment_pending_verification", "sales", {
        payments: [{ status: "pending" }],
      }).cta,
    ).toBeUndefined();
  });

  it("asks Sales to re-record after Accounts rejects a payment", () => {
    const result = action("payment_pending_verification", "sales", {
      payments: [{ status: "rejected" }],
    });
    expect(result.title).toBe("Record a corrected payment");
    expect(result.cta).toBe("Record payment");
  });

  it("gives Procurement vendor CTAs and Delivery the handover CTA", () => {
    expect(action("order_active", "procurement").cta).toBe("Send to vendor");
    expect(action("order_active", "sales").cta).toBeUndefined();
    expect(action("sent_to_vendor", "procurement").cta).toBe("Mark dispatched");
    expect(action("vendor_dispatched", "store").cta).toBe("Record receipt");
    expect(action("vendor_dispatched", "sales").cta).toBeUndefined();
    expect(action("delivery_unlocked", "store").cta).toBe("Complete delivery");
    expect(action("delivery_unlocked", "sales").cta).toBeUndefined();
    expect(action("delivery_unlocked", "admin").cta).toBe("Complete delivery");
  });

  it("shows outstanding on hold and a record CTA when a balance remains", () => {
    const hold = action("order_on_hold", "sales", {
      outstanding: 50_000,
      payments: [{ status: "verified" }],
    });
    expect(hold.title).toMatch(/outstanding/);
    expect(hold.cta).toBe("Record payment");
    const paid = action("items_received", "store", { outstanding: 0 });
    expect(paid.detail).toMatch(/Payment is complete/);
    expect(paid.cta).toBe("Open delivery");
  });

  it("follows the live order status when the quote is still marked sent", () => {
    const result = action("quote_sent_to_customer", "procurement", {
      orderStatus: "order_active",
    });
    expect(result.cta).toBe("Send to vendor");
  });

  it("asks for installation after close when none is booked", () => {
    expect(action("closed", "sales", { hasInstallation: true }).title).toBe("Order closed");
    expect(action("closed", "sales", { hasInstallation: false }).cta).toBe("Schedule");
    expect(action("closed", "accounts", { hasInstallation: false }).cta).toBe("View order");
    expect(action("cancelled", "sales").title).toBe("Cancelled");
  });

  it("lets Admin act at every desk that a specialist would", () => {
    expect(action("quote_pending_accounts", "admin").cta).toBe("Review");
    expect(action("order_active", "admin").cta).toBe("Send to vendor");
    expect(action("delivery_unlocked", "admin").cta).toBe("Complete delivery");
    expect(action("quote_approved", "admin").cta).toBe("Send");
  });
});
