import { describe, expect, it } from "vitest";
import { canSeeProductCost } from "@/lib/auth/permissions";
import { formatDocumentNumber, isDocumentNumber, isOrderNumber } from "@/lib/documents/number";

describe("quote and order numbers", () => {
  const october = new Date("2026-10-06T10:00:00+05:30");

  it("builds the Nuhome month-year format from India time", () => {
    expect(formatDocumentNumber("QT", 0, october)).toBe("QT0000NUOCT26");
    expect(formatDocumentNumber("QT", 1, october)).toBe("QT0001NUOCT26");
    expect(formatDocumentNumber("OR", 0, october)).toBe("OR0000NUOCT26");
    expect(formatDocumentNumber("OR", 1, october)).toBe("OR0001NUOCT26");
    expect(formatDocumentNumber("QT", 10000, october)).toBe("QT10000NUOCT26");
  });

  it("uses the India date when UTC is still the previous month", () => {
    expect(formatDocumentNumber("OR", 2, new Date("2026-09-30T19:00:00Z"))).toBe(
      "OR0002NUOCT26",
    );
    expect(formatDocumentNumber("QT", 3, new Date("2026-10-31T18:30:00Z"))).toBe(
      "QT0003NUNOV26",
    );
  });

  it("recognizes issued numbers and leaves quotation numbers off the order lookup", () => {
    expect(isDocumentNumber("QT0000NUOCT26")).toBe(true);
    expect(isOrderNumber("OR0001NUOCT26")).toBe(true);
    expect(isOrderNumber("or10000nujan26")).toBe(true);
    expect(isOrderNumber("QT0001NUOCT26")).toBe(false);
    expect(isOrderNumber("ORD-1042")).toBe(true);
  });
});

describe("product cost visibility", () => {
  it("shows cost to accounts, procurement, operations, and admin", () => {
    expect(canSeeProductCost(["sales"])).toBe(false);
    expect(canSeeProductCost(["store"])).toBe(false);
    expect(canSeeProductCost(["accounts"])).toBe(true);
    expect(canSeeProductCost(["procurement"])).toBe(true);
    expect(canSeeProductCost(["operations"])).toBe(true);
    expect(canSeeProductCost(["admin"])).toBe(true);
    expect(canSeeProductCost(["sales", "accounts"])).toBe(true);
  });
});
