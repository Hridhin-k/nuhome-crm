import { describe, expect, it } from "vitest";
import { notificationHref, type AppNotification } from "@/lib/notifications/types";

function notice(
  type: string,
  payload: Record<string, unknown> = {},
): AppNotification {
  return {
    id: "n1",
    type,
    title: type,
    body: null,
    payload,
    read_at: null,
    created_at: "2026-08-16T00:00:00.000Z",
  };
}

describe("notificationHref", () => {
  it("sends each role to the screen that has the work", () => {
    expect(
      notificationHref(notice("QUOTE_SUBMITTED", { quote_id: "q1" })),
    ).toBe("/approvals/q1");
    expect(notificationHref(notice("PAYMENT_RECORDED"))).toBe("/payments");
    expect(
      notificationHref(notice("ORDER_ACTIVATED", { order_id: "o1" })),
    ).toBe("/fulfillment/o1");
    expect(
      notificationHref(notice("DELIVERY_UNLOCKED", { order_id: "o1" })),
    ).toBe("/orders/o1");
    expect(
      notificationHref(notice("ORDER_PLACED_ON_HOLD", { order_id: "o1" })),
    ).toBe("/orders/o1");
    expect(
      notificationHref(notice("VENDOR_DISPATCHED", { order_id: "o1" })),
    ).toBe("/orders/o1");
    expect(
      notificationHref(notice("ORDER_DELIVERED", { order_id: "o1" })),
    ).toBe("/orders/o1");
    expect(
      notificationHref(notice("ORDER_CANCELLED", { order_id: "o1" })),
    ).toBe("/orders/o1");
    expect(
      notificationHref(notice("QUOTE_CANCELLED", { quote_id: "q1" })),
    ).toBe("/quotes/q1");
  });

  it("keeps quote approval and return on the quote page", () => {
    expect(
      notificationHref(notice("QUOTE_APPROVED", { quote_id: "q1" })),
    ).toBe("/quotes/q1");
    expect(
      notificationHref(notice("QUOTE_REJECTED", { quote_id: "q1" })),
    ).toBe("/quotes/q1");
  });
});
