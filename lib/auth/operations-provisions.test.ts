import { describe, expect, it } from "vitest";
import { roleHasPermission } from "@/lib/auth/permissions";
import { navForRole } from "@/lib/auth/nav";

/**
 * Every Operations permission must map to a reachable surface
 * (bottom bar, More, or an in-page action behind that permission).
 */
const OPS_SURFACES: Record<string, string[]> = {
  "customers.read": ["/customers"],
  "customers.write": ["/customers"],
  "quotes.approve": ["/approvals"],
  "quotes.reject": ["/approvals"],
  "quotes.read_margin": ["/approvals", "/quotes"],
  "payments.verify": ["/payments"],
  "orders.read": ["/orders"],
  "orders.send_to_vendor": ["/fulfillment", "/vendors"],
  "fulfillment.update": ["/fulfillment"],
  "catalog.manage": ["/materials", "/vendors", "/company"],
  "staff.manage": ["/users"],
  "leads.manage": ["/leads"],
  "reports.read": ["/reports"],
  "deliveries.credit_approve": ["/orders"],
  "vendors.quote_approve": ["/fulfillment"],
};

describe("operations provisions are reachable", () => {
  it("keeps Ops on a floor + reports bar", () => {
    expect(navForRole("operations").map((item) => item.href)).toEqual([
      "/home",
      "/orders",
      "/fulfillment",
      "/reports",
      "/more",
    ]);
  });

  it("grants every listed surface permission to operations", () => {
    for (const permission of Object.keys(OPS_SURFACES)) {
      expect(roleHasPermission("operations", permission as never)).toBe(true);
    }
  });
});
