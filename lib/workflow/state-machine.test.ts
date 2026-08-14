import { describe, expect, it } from "vitest";
import { assertTransition, canSendQuoteToCustomer } from "@/lib/workflow/state-machine";

describe("quote transitions", () => {
  it("allows draft to pending_accounts", () => {
    expect(() =>
      assertTransition("quote_draft", "quote_pending_accounts"),
    ).not.toThrow();
  });

  it("rejects sending an unapproved quote", () => {
    expect(canSendQuoteToCustomer("quote_rejected")).toBe(false);
    expect(canSendQuoteToCustomer("quote_draft")).toBe(false);
    expect(canSendQuoteToCustomer("quote_approved")).toBe(true);
  });

  it("requires a new version after rejection", () => {
    expect(() => assertTransition("quote_rejected", "quote_draft")).not.toThrow();
    expect(() =>
      assertTransition("quote_rejected", "quote_sent_to_customer"),
    ).toThrow();
  });
});

describe("order transitions", () => {
  it("blocks delivery from items_received without the payment gate", () => {
    expect(() => assertTransition("items_received", "delivered")).toThrow();
    expect(() =>
      assertTransition("items_received", "delivery_pending_payment"),
    ).not.toThrow();
  });

  it("routes unpaid delivery to on hold", () => {
    expect(() =>
      assertTransition("delivery_pending_payment", "order_on_hold"),
    ).not.toThrow();
    expect(() =>
      assertTransition("order_on_hold", "payment_pending_verification"),
    ).not.toThrow();
  });
});
