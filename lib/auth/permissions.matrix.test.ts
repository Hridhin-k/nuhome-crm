import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  roleHasPermission,
  rolesHavePermission,
  type Permission,
} from "@/lib/auth/permissions";
import { APP_ROLES, type AppRole } from "@/lib/workflow/types";

const GRANTED: Record<AppRole, readonly Permission[]> = {
  sales: [
    "customers.read",
    "customers.write",
    "quotes.create",
    "quotes.revise",
    "quotes.submit",
    "quotes.send_to_customer",
    "payments.record",
    "orders.read",
  ],
  accounts: [
    "customers.read",
    "quotes.approve",
    "quotes.reject",
    "quotes.read_margin",
    "payments.verify",
    "orders.read",
  ],
  procurement: [
    "customers.read",
    "orders.read",
    "orders.send_to_vendor",
    "fulfillment.update",
  ],
  store: [
    "customers.read",
    "orders.read",
    "fulfillment.update",
    "payments.record",
    "deliveries.complete",
  ],
  admin: PERMISSIONS,
};

describe("role × permission matrix", () => {
  it("decides every permission for every role with nothing skipped", () => {
    for (const role of APP_ROLES) {
      for (const permission of PERMISSIONS) {
        expect(roleHasPermission(role, permission)).toBe(
          GRANTED[role].includes(permission),
        );
      }
    }
  });

  it("never lets Sales approve, reject, verify, or complete delivery", () => {
    expect(roleHasPermission("sales", "quotes.approve")).toBe(false);
    expect(roleHasPermission("sales", "quotes.reject")).toBe(false);
    expect(roleHasPermission("sales", "payments.verify")).toBe(false);
    expect(roleHasPermission("sales", "deliveries.complete")).toBe(false);
    expect(roleHasPermission("sales", "orders.send_to_vendor")).toBe(false);
    expect(roleHasPermission("sales", "admin.manage")).toBe(false);
  });

  it("never lets Accounts create quotes, record payment, or send to vendor", () => {
    expect(roleHasPermission("accounts", "quotes.create")).toBe(false);
    expect(roleHasPermission("accounts", "quotes.send_to_customer")).toBe(false);
    expect(roleHasPermission("accounts", "payments.record")).toBe(false);
    expect(roleHasPermission("accounts", "orders.send_to_vendor")).toBe(false);
    expect(roleHasPermission("accounts", "deliveries.complete")).toBe(false);
  });

  it("never lets Procurement touch money or quotes", () => {
    expect(roleHasPermission("procurement", "quotes.create")).toBe(false);
    expect(roleHasPermission("procurement", "quotes.approve")).toBe(false);
    expect(roleHasPermission("procurement", "payments.record")).toBe(false);
    expect(roleHasPermission("procurement", "payments.verify")).toBe(false);
    expect(roleHasPermission("procurement", "deliveries.complete")).toBe(false);
  });

  it("lets Delivery record handover cash but never verify or approve", () => {
    expect(roleHasPermission("store", "payments.record")).toBe(true);
    expect(roleHasPermission("store", "deliveries.complete")).toBe(true);
    expect(roleHasPermission("store", "payments.verify")).toBe(false);
    expect(roleHasPermission("store", "quotes.approve")).toBe(false);
    expect(roleHasPermission("store", "quotes.create")).toBe(false);
  });

  it("unions extra hats without granting a missing duty", () => {
    expect(rolesHavePermission(["sales", "store"], "deliveries.complete")).toBe(true);
    expect(rolesHavePermission(["sales", "store"], "quotes.approve")).toBe(false);
    expect(rolesHavePermission(["sales", "accounts"], "quotes.approve")).toBe(true);
    expect(rolesHavePermission(["sales", "accounts"], "quotes.create")).toBe(true);
    expect(rolesHavePermission(["procurement", "store"], "payments.verify")).toBe(false);
    expect(rolesHavePermission([], "orders.read")).toBe(false);
  });
});
