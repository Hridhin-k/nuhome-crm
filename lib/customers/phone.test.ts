import { describe, expect, it } from "vitest";
import {
  isComparablePhone,
  isLocalMobile,
  normalizePhone,
  sanitizeLocalMobileInput,
} from "@/lib/customers/phone";

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

describe("sanitizeLocalMobileInput", () => {
  it("keeps only 10 local digits and drops letters", () => {
    expect(sanitizeLocalMobileInput("ab12cd34ef")).toBe("1234");
    expect(sanitizeLocalMobileInput("98765432101234")).toBe("9876543210");
    expect(sanitizeLocalMobileInput("+91 98765 43210")).toBe("9876543210");
    expect(sanitizeLocalMobileInput("09876543210")).toBe("9876543210");
  });
});

describe("isLocalMobile", () => {
  it("allows empty or a 10-digit number and rejects text", () => {
    expect(isLocalMobile("")).toBe(true);
    expect(isLocalMobile(undefined)).toBe(true);
    expect(isLocalMobile("9876543210")).toBe(true);
    expect(isLocalMobile("+91 98765 43210")).toBe(true);
    expect(isLocalMobile("contact")).toBe(false);
    expect(isLocalMobile("98765")).toBe(false);
  });
});
