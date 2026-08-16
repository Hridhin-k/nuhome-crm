import { describe, expect, it } from "vitest";
import { pickHomeFocus, type InboxItem } from "@/components/app/inbox-list";

function item(title: string, count: number, extra?: Partial<InboxItem>): InboxItem {
  return { title, count, href: "/", detail: "", ...extra };
}

describe("pickHomeFocus", () => {
  it("prefers overdue work over quieter queues", () => {
    const focus = pickHomeFocus([
      item("Pending quotes", 4),
      item("Vendor overdue", 1),
      item("Customers", 20),
    ]);
    expect(focus?.title).toBe("Vendor overdue");
  });

  it("falls back to the first live queue when nothing is on fire", () => {
    const focus = pickHomeFocus([
      item("Pending quotes", 2),
      item("Customers", 9),
    ]);
    expect(focus?.title).toBe("Pending quotes");
  });

  it("returns null when the desk is clear", () => {
    expect(pickHomeFocus([item("Pending quotes", 0)])).toBeNull();
  });
});
