import { describe, expect, it } from "vitest";
import { displaySpecification, splitItemNameAndSpec } from "@/lib/quotes/spec";

describe("quote specification", () => {
  it("splits a legacy name — detail description", () => {
    expect(splitItemNameAndSpec("Cabinet — 600mm white")).toEqual({
      name: "Cabinet",
      specification: "600mm white",
    });
  });

  it("prefers the stored specification", () => {
    expect(
      displaySpecification("Soft-close, white", "Cabinet — old note"),
    ).toBe("Soft-close, white");
    expect(displaySpecification(null, "Cabinet — old note")).toBe("old note");
  });
});
