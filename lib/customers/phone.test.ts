import { describe, expect, it } from "vitest";
import { isComparablePhone, normalizePhone } from "@/lib/customers/phone";

describe("normalizePhone", () => {
  it("strips formatting and country code", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("9876543210")).toBe("9876543210");
  });

  it("ignores empty values", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(isComparablePhone("123")).toBe(false);
    expect(isComparablePhone("9876543210")).toBe(true);
  });
});
