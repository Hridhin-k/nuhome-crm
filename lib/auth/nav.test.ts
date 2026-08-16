import { describe, expect, it } from "vitest";
import { navForRoles, overflowNavForRoles, roleLabels } from "@/lib/auth/nav";

describe("navForRoles", () => {
  it("keeps the primary bar when there is only one hat", () => {
    const items = navForRoles(["sales"], "sales").map((item) => item.href);
    expect(items).toEqual([
      "/home",
      "/customers",
      "/quotes",
      "/orders",
      "/more",
    ]);
    expect(overflowNavForRoles(["sales"], "sales")).toEqual([]);
  });

  it("parks extra-hat screens in More when the bar is full", () => {
    const bar = navForRoles(["sales", "store"], "sales").map((item) => item.href);
    expect(bar).toEqual([
      "/home",
      "/customers",
      "/quotes",
      "/orders",
      "/more",
    ]);
    expect(overflowNavForRoles(["sales", "store"], "sales").map((item) => item.href)).toEqual([
      "/ready",
    ]);
  });

  it("joins role labels", () => {
    expect(roleLabels(["sales", "store"])).toBe("Sales + Delivery");
  });
});
