import { describe, expect, it } from "vitest";
import { notificationBody } from "@/lib/notifications/copy";

describe("notificationBody", () => {
  it("starts with customer name then status, ref, and item", () => {
    expect(
      notificationBody({
        customerName: "Priya Nair",
        status: "payment pending",
        ref: "ORD-1042",
        item: "Cabinet",
        detail: "Waiting for verification.",
      }),
    ).toBe(
      "Priya Nair · payment pending · ORD-1042 · Cabinet. Waiting for verification.",
    );
  });

  it("falls back to the detail when nothing else is present", () => {
    expect(notificationBody({ detail: "A job is waiting." })).toBe(
      "A job is waiting.",
    );
  });
});
