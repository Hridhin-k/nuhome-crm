import { describe, expect, it } from "vitest";
import {
  daysSitting,
  defaultDateRange,
  formatIstDateTime,
  inDateRange,
  kolkataDate,
  matchesSearch,
  parseYmd,
  pathWithQuery,
  rangeToIso,
  sanitizeSearch,
} from "@/lib/search";
import { parseCsv, toCsv } from "@/lib/csv";
import { notificationHref, type AppNotification } from "@/lib/notifications/types";
import {
  parseOrderBucket,
  parseQuoteGroup,
  statusesForOrderQuery,
  floorHref,
  QUOTE_ONLY_STATUSES,
} from "@/lib/workflow/status-buckets";
import { pickHomeFocus, type InboxItem } from "@/components/app/inbox-list";
import {
  agingCsv,
  collectionsCsv,
  csvFilename,
  queuesCsv,
  reportExportToCsv,
  sittingCsv,
} from "@/lib/reports/csv-export";
import type { OperationsSnapshot } from "@/lib/api/dashboard";

function notice(type: string, payload: Record<string, unknown> = {}): AppNotification {
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

describe("search, dates, and CSV extras", () => {
  it("builds a 30-day IST range and ISO bounds", () => {
    const range = defaultDateRange(new Date("2026-08-16T10:00:00+05:30"));
    expect(range.to).toBe("2026-08-16");
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(kolkataDate(new Date("2026-08-16T22:30:00.000Z"))).toBe("2026-08-17");
    const iso = rangeToIso("2026-08-01", "2026-08-16");
    expect(iso.start).toContain("2026-07-31");
    expect(iso.end).toContain("2026-08-16");
  });

  it("counts sitting days and treats invalid dates as 0", () => {
    expect(daysSitting("2026-08-10T00:00:00.000Z", new Date("2026-08-16T00:00:00.000Z"))).toBe(6);
    expect(daysSitting("nope")).toBe(0);
    expect(inDateRange(null)).toBe(true);
    expect(inDateRange(null, "2026-08-01")).toBe(false);
    expect(inDateRange("2026-08-01", "2026-08-01", "2026-08-01")).toBe(true);
    expect(parseYmd(undefined)).toBeNull();
    expect(formatIstDateTime("2026-08-16T08:30:00.000Z")).toMatch(/2026/);
  });

  it("strips SQL metacharacters and builds list URLs", () => {
    expect(sanitizeSearch("a,b(c)")).toBe("abc");
    expect(matchesSearch([null, "NH-1"], "nh-1")).toBe(true);
    expect(pathWithQuery("/orders", { q: null, bucket: "hold" })).toBe("/orders?bucket=hold");
    expect(pathWithQuery("/orders", { q: "", bucket: "" })).toBe("/orders");
  });

  it("round-trips quoted commas, doubled quotes, and newlines", () => {
    const csv = toCsv(["name", "notes"], [['Vendor, "Co"', "line1\nline2"]]);
    expect(csv).toContain('""');
    const { rows } = parseCsv(csv);
    expect(rows[0].name).toBe('Vendor, "Co"');
    expect(rows[0].notes).toContain("line1");
    expect(parseCsv("").rows).toEqual([]);
  });
});

describe("notification fallbacks", () => {
  it("falls back to list pages when ids are missing and to quote/order for unknown types", () => {
    expect(notificationHref(notice("QUOTE_SUBMITTED"))).toBe("/approvals");
    expect(notificationHref(notice("QUOTE_APPROVED"))).toBe("/quotes");
    expect(notificationHref(notice("DELIVERY_UNLOCKED"))).toBe("/ready");
    expect(notificationHref(notice("ORDER_ACTIVATED"))).toBe("/fulfillment");
    expect(notificationHref(notice("ORDER_DELIVERED"))).toBe("/orders");
    expect(notificationHref(notice("QUOTE_CANCELLED"))).toBe("/quotes");
    expect(notificationHref(notice("UNKNOWN", { quote_id: "q1" }))).toBe("/quotes/q1");
    expect(notificationHref(notice("UNKNOWN", { order_id: "o1" }))).toBe("/orders/o1");
    expect(notificationHref(notice("UNKNOWN"))).toBeNull();
    expect(notificationHref(notice("QUOTE_SUBMITTED", { quote_id: 99 }))).toBe("/approvals");
  });
});

describe("list query helpers and home focus", () => {
  it("parses order buckets, attention, and quote groups", () => {
    expect(parseOrderBucket("hold")).toBe("hold");
    expect(parseOrderBucket("nope")).toBeNull();
    expect(parseOrderBucket(undefined)).toBeNull();
    expect(statusesForOrderQuery({ status: "sent_to_vendor" })).toEqual({
      bucket: "active",
      filter: "sent_to_vendor",
    });
    expect(statusesForOrderQuery({ bucket: "delivery" }).bucket).toBe("delivery");
    expect(statusesForOrderQuery({ bucket: "attention" }).filter).toEqual([
      "quote_sent_to_customer",
      "payment_pending_verification",
      "order_on_hold",
      "delivery_pending_payment",
    ]);
    expect(statusesForOrderQuery({}).bucket).toBe("open");
    expect(parseQuoteGroup("quote")).toBe("quote");
    expect(parseQuoteGroup("nope")).toBe("open");
    for (const status of QUOTE_ONLY_STATUSES) {
      expect(floorHref(status)).toContain("/quotes?");
    }
  });

  it("skips empty and directory cards, and prefers approval/ready over quieter queues", () => {
    const item = (title: string, count: number, extra?: Partial<InboxItem>): InboxItem => ({
      title,
      count,
      href: "/",
      detail: "",
      ...extra,
    });
    expect(
      pickHomeFocus([item("Customers", 9, { kind: "directory" }), item("Ready to deliver", 1)])
        ?.title,
    ).toBe("Ready to deliver");
    expect(
      pickHomeFocus([item("Pending quotes", 2), item("Payment verification", 1)])?.title,
    ).toBe("Payment verification");
    expect(pickHomeFocus([item("Customers", 9, { kind: "directory" })])).toBeNull();
    expect(pickHomeFocus([item("Vendor overdue", 2, { alert: true })])?.title).toBe(
      "Vendor overdue",
    );
  });
});

describe("remaining report CSVs", () => {
  it("writes queues, collections, sitting, aging, and a date-less filename", () => {
    const snapshot = {
      queues: [{ title: "Pending quotes", count: 2, detail: "Accounts" }],
      census: [],
    } as unknown as OperationsSnapshot;
    expect(queuesCsv(snapshot)).toContain("Pending quotes");
    expect(
      collectionsCsv([
        {
          id: "1",
          paidAt: "2026-08-16T08:30:00.000Z",
          amount: 5000,
          kind: "advance",
          method: "upi",
          reference: "UPI123",
          quoteNumber: "NH-1",
          orderNumber: "ORD-1",
          recordedBy: "Sales Demo",
        },
      ]),
    ).toContain("UPI123");
    expect(
      sittingCsv([
        {
          id: "1",
          name: "Priya",
          role: "Sales",
          waitingQuotes: 1,
          pendingPayments: 2,
          agingOrders: 3,
        },
      ]),
    ).toContain("Priya");
    expect(
      agingCsv([
        {
          id: "1",
          href: "/quotes/1",
          title: "NH-1",
          owner: "Sales Demo",
          days: 4,
          status: "quote_pending_accounts",
        },
      ]),
    ).toContain("NH-1");
    expect(csvFilename("floor")).toMatch(/^nuhome-floor-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(
      reportExportToCsv({
        kind: "queues",
        snapshot,
      }).filename,
    ).toMatch(/queues/);
    expect(
      reportExportToCsv({
        kind: "collections",
        from: "2026-08-01",
        to: "2026-08-16",
        rows: [],
      }).filename,
    ).toBe("nuhome-collections-2026-08-01-to-2026-08-16.csv");
    expect(
      reportExportToCsv({
        kind: "sitting",
        from: "2026-08-01",
        to: "2026-08-16",
        rows: [],
      }).csv,
    ).toContain("staff");
    expect(
      reportExportToCsv({
        kind: "aging",
        from: "2026-08-01",
        to: "2026-08-16",
        rows: [],
      }).csv,
    ).toContain("days_sitting");
  });
});
