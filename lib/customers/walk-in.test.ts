import { describe, expect, it } from "vitest";
import { listFromForm, withOtherValue } from "@/lib/customers/walk-in";

describe("withOtherValue", () => {
  it("replaces Others with the typed value", () => {
    expect(withOtherValue(["Laminates", "Others"], "Others", "Custom item")).toEqual([
      "Laminates",
      "Custom item",
    ]);
  });

  it("drops Others when no typed value is given", () => {
    expect(withOtherValue(["Others"], "Others", "  ")).toEqual([]);
  });

  it("leaves lists without Others unchanged", () => {
    expect(withOtherValue(["Laminates"], "Others", "Custom")).toEqual(["Laminates"]);
  });
});

describe("listFromForm", () => {
  it("trims and drops empty entries", () => {
    expect(listFromForm(["  a ", "", "b"])).toEqual(["a", "b"]);
  });
});
