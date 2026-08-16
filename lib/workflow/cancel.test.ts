import { describe, expect, it } from "vitest";
import { canCancelJob } from "@/lib/workflow/cancel";

describe("canCancelJob", () => {
  it("lets Sales cancel a live quote or order", () => {
    expect(
      canCancelJob({ quoteStatus: "quote_draft", roles: ["sales"] }),
    ).toBe(true);
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "sent_to_vendor",
        roles: ["sales"],
      }),
    ).toBe(true);
  });

  it("lets Accounts cancel only a pending quote, not an order", () => {
    expect(
      canCancelJob({
        quoteStatus: "quote_pending_accounts",
        roles: ["accounts"],
      }),
    ).toBe(true);
    expect(
      canCancelJob({ quoteStatus: "quote_draft", roles: ["accounts"] }),
    ).toBe(false);
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "order_active",
        roles: ["accounts"],
      }),
    ).toBe(false);
  });

  it("lets Procurement cancel an order but blocks Store", () => {
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "sent_to_vendor",
        roles: ["procurement"],
      }),
    ).toBe(true);
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "sent_to_vendor",
        roles: ["store"],
      }),
    ).toBe(false);
  });

  it("blocks delivered, closed, and already cancelled jobs", () => {
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "delivered",
        roles: ["sales"],
      }),
    ).toBe(false);
    expect(
      canCancelJob({ quoteStatus: "cancelled", roles: ["sales"] }),
    ).toBe(false);
  });
});
