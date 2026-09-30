import { describe, expect, it } from "vitest";
import {
  formatSpecsInline,
  formatSpecValues,
  normalizeMaterialSpecs,
} from "@/lib/catalog/material-specs";

describe("material specs", () => {
  it("keeps filled pairs and drops half-filled rows", () => {
    expect(
      normalizeMaterialSpecs([
        { label: " Colour ", value: " White " },
        { label: "Dimensions", value: "" },
        { label: "", value: "Matte" },
        { label: "Finish", value: "Matte" },
      ]),
    ).toEqual([
      { label: "Colour", value: "White" },
      { label: "Finish", value: "Matte" },
    ]);
    expect(normalizeMaterialSpecs(null)).toEqual([]);
  });

  it("rejects too many specs or very long values", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ label: `L${i}`, value: "x" }));
    expect(() => normalizeMaterialSpecs(many)).toThrow("at most 12");
    expect(() =>
      normalizeMaterialSpecs([{ label: "Colour", value: "x".repeat(121) }]),
    ).toThrow("too long");
  });

  it("formats specs for quote lines and the catalogue", () => {
    const specs = [
      { label: "Colour", value: "White" },
      { label: "Dimensions", value: "600 × 560 mm" },
    ];
    expect(formatSpecsInline(specs)).toBe("Colour: White · Dimensions: 600 × 560 mm");
    expect(formatSpecValues(specs)).toBe("White · 600 × 560 mm");
    expect(formatSpecsInline("bad")).toBe("");
  });
});
