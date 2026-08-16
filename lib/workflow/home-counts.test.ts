import { describe, expect, it } from "vitest";
import {
  completedOrderCount,
  liveJobCount,
  liveStatus,
  openQuoteCount,
  ordersInBucket,
  workWaiting,
} from "@/lib/workflow/home-counts";

describe("home counts", () => {
  it("counts only quotes that have not become an order", () => {
    expect(
      openQuoteCount([
        { status: "quote_draft" },
        { status: "quote_pending_accounts" },
        { status: "quote_approved" },
        { status: "quote_rejected" },
        { status: "quote_sent_to_customer", order: { status: "quote_sent_to_customer" } },
        { status: "quote_sent_to_customer", order: { status: "order_active" } },
      ]),
    ).toBe(4);
  });

  it("uses the order status once an order exists", () => {
    expect(
      liveStatus({
        status: "quote_sent_to_customer",
        order: { status: "closed" },
      }),
    ).toBe("closed");
  });

  it("keeps payment-stage orders out of the active bucket", () => {
    const orders = [
      { status: "quote_sent_to_customer" },
      { status: "payment_pending_verification" },
      { status: "order_active" },
      { status: "sent_to_vendor" },
      { status: "order_on_hold" },
      { status: "delivery_unlocked" },
      { status: "closed" },
    ];
    expect(ordersInBucket(orders, "payment")).toBe(2);
    expect(ordersInBucket(orders, "active")).toBe(2);
    expect(ordersInBucket(orders, "hold")).toBe(1);
    expect(ordersInBucket(orders, "delivery")).toBe(1);
    expect(completedOrderCount(orders)).toBe(1);
  });

  it("does not treat cancelled jobs as delivered", () => {
    expect(
      completedOrderCount([
        { status: "delivered" },
        { status: "closed" },
        { status: "cancelled" },
      ]),
    ).toBe(2);
  });

  it("counts unique live jobs from the census", () => {
    expect(
      liveJobCount([
        { status: "quote_draft", count: 2 },
        { status: "quote_sent_to_customer", count: 1 },
        { status: "order_active", count: 3 },
        { status: "closed", count: 4 },
        { status: "cancelled", count: 1 },
      ]),
    ).toBe(6);
  });

  it("excludes directory cards from work waiting", () => {
    expect(
      workWaiting([
        { count: 3 },
        { count: 10, kind: "directory" },
        { count: 2 },
        { count: 4, kind: "flag" },
      ]),
    ).toBe(5);
  });
});
