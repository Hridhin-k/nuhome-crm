import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { formatAuditEvent, type AuditEvent } from "@/lib/workflow/audit-labels";
import { auditCsv, csvFilename, floorCsv, withExcelBom } from "@/lib/reports/csv-export";
import type { OperationsSnapshot, StatusCensus } from "@/lib/api/dashboard";

describe("csvFilename", () => {
  it("uses the date range in the download name", () => {
    expect(csvFilename("audit", "2026-07-18", "2026-08-16")).toBe(
      "nuhome-audit-2026-07-18-to-2026-08-16.csv",
    );
  });
});

describe("auditCsv", () => {
  it("writes a readable production row", () => {
    const event: AuditEvent = {
      id: "1",
      actor_id: "a",
      actor_role: "accounts",
      actor_name: "Priya",
      action: "QUOTE_APPROVED",
      entity_type: "quote",
      entity_id: "q1",
      old_state: "quote_pending_accounts",
      new_state: "quote_approved",
      metadata: { version: 2 },
      created_at: "2026-08-16T08:30:00.000Z",
    };
    const csv = auditCsv([event]);
    expect(csv).toContain("when_ist,action,title");
    expect(csv).toContain("QUOTE_APPROVED");
    expect(csv).toContain("Quote approved");
    expect(csv).toContain("Accounts · Priya");
    expect(formatAuditEvent(event).detail).toContain("Version 2");
  });
});

describe("floorCsv", () => {
  it("lists every census cell", () => {
    const census: StatusCensus[] = [
      { status: "quote_draft", count: 2, href: "/quotes?group=quote&status=quote_draft" },
      { status: "sent_to_vendor", count: 1, href: "/orders?status=sent_to_vendor" },
    ];
    const snapshot = { census } as OperationsSnapshot;
    expect(floorCsv(snapshot)).toBe(
      toCsv(
        ["status", "label", "jobs"],
        [
          ["quote_draft", "Draft", 2],
          ["sent_to_vendor", "With vendor", 1],
        ],
      ),
    );
  });
});

describe("withExcelBom", () => {
  it("prefixes UTF-8 BOM so Excel opens names correctly", () => {
    expect(withExcelBom("a,b")).toBe("\uFEFFa,b");
  });
});
