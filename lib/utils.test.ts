import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps type-scale sizes next to text colours", () => {
    expect(cn("text-headline-lg text-on-surface")).toBe(
      "text-headline-lg text-on-surface",
    );
    expect(cn("text-subheading text-primary-foreground")).toBe(
      "text-subheading text-primary-foreground",
    );
  });

  it("lets a later size override an earlier one", () => {
    expect(cn("text-subheading", "text-body-sm")).toBe("text-body-sm");
    expect(cn("text-body-md", "text-[12px]")).toBe("text-[12px]");
  });

  it("treats shadow-card as a shadow", () => {
    expect(cn("shadow-card", "shadow-none")).toBe("shadow-none");
  });
});
