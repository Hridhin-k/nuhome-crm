import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/lib/workflow/types";
import {
  displayWorkflowStatus,
  floorHref,
  isClosedOrderStatus,
  latestOpenOrder,
  ORDER_BUCKET_STATUSES,
  orderBucket,
  quoteListGroup,
} from "@/lib/workflow/status-buckets";

describe("order status buckets", () => {
  it("never puts closed or delivered orders in open, active, or payment buckets", () => {
    expect(ORDER_BUCKET_STATUSES.active).not.toContain("closed");
    expect(ORDER_BUCKET_STATUSES.active).not.toContain("delivered");
    expect(ORDER_BUCKET_STATUSES.payment).not.toContain("closed");
    expect(ORDER_BUCKET_STATUSES.open).not.toContain("closed");
    expect(ORDER_BUCKET_STATUSES.open).not.toContain("delivered");
    expect(orderBucket("closed")).toBe("closed");
    expect(orderBucket("delivered")).toBe("closed");
    expect(orderBucket("cancelled")).toBe("closed");
    expect(ORDER_BUCKET_STATUSES.open).not.toContain("cancelled");
    expect(orderBucket("payment_pending_verification")).toBe("payment");
  });

  it("classifies every order status as either open or closed, never both", () => {
    for (const status of ORDER_STATUSES) {
      const closed = isClosedOrderStatus(status);
      const inOpen = (ORDER_BUCKET_STATUSES.open as readonly string[]).includes(status);
      const inClosed = (ORDER_BUCKET_STATUSES.closed as readonly string[]).includes(
        status,
      );
      expect(inOpen).toBe(!closed);
      expect(inClosed).toBe(closed);
      expect(orderBucket(status) === "closed").toBe(closed);
    }
  });

  it("shows the order status on quotes once an order exists", () => {
    expect(displayWorkflowStatus("quote_sent_to_customer", "closed")).toBe("closed");
    expect(displayWorkflowStatus("quote_sent_to_customer", "order_active")).toBe(
      "order_active",
    );
    expect(displayWorkflowStatus("quote_draft")).toBe("quote_draft");
  });

  it("groups a closed order separately from payment and in-progress", () => {
    expect(quoteListGroup("closed")).toBe("closed");
    expect(quoteListGroup("cancelled")).toBe("closed");
    expect(quoteListGroup("payment_pending_verification")).toBe("payment");
    expect(quoteListGroup("order_active")).toBe("active");
    expect(quoteListGroup("quote_draft")).toBe("quote");
  });

  it("deep-links the floor board into the matching list", () => {
    expect(floorHref("quote_draft")).toBe(
      "/quotes?group=quote&status=quote_draft",
    );
    expect(floorHref("cancelled")).toBe(
      "/quotes?group=closed&status=cancelled",
    );
    expect(floorHref("sent_to_vendor")).toBe("/orders?status=sent_to_vendor");
  });

  it("prefers an open order over a closed one for customer badges", () => {
    const latest = latestOpenOrder([
      { id: "1", status: "closed" },
      { id: "2", status: "order_active" },
    ]);
    expect(latest?.id).toBe("2");
  });
});
