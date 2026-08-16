import { describe, expect, it } from "vitest";
import {
  inDateRange,
  matchesSearch,
  parseYmd,
  pathWithQuery,
  sanitizeSearch,
} from "@/lib/search";

describe("list search helpers", () => {
  it("matches quote number, phone, and name", () => {
    expect(
      matchesSearch(["NH-1042", "Priya", "9876543210"], "1042"),
    ).toBe(true);
    expect(matchesSearch(["NH-1042", "Priya"], "98765")).toBe(false);
    expect(matchesSearch(["Priya Nair"], " priya ")).toBe(true);
    expect(matchesSearch(["Priya"], "")).toBe(true);
  });

  it("filters calendar dates in IST", () => {
    expect(parseYmd("2026-08-01")).toBe("2026-08-01");
    expect(parseYmd("nope")).toBeNull();
    expect(inDateRange("2026-08-10T10:00:00+05:30", "2026-08-01", "2026-08-16")).toBe(
      true,
    );
    expect(inDateRange("2026-07-31T22:00:00+05:30", "2026-08-01", "2026-08-16")).toBe(
      false,
    );
  });

  it("strips SQL wildcards from search", () => {
    expect(sanitizeSearch("%foo_bar%")).toBe("foobar");
  });

  it("omits empty query params", () => {
    expect(pathWithQuery("/quotes", { q: "nh", group: undefined })).toBe(
      "/quotes?q=nh",
    );
  });
});
