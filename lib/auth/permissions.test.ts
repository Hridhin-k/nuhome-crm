import { describe, expect, it } from "vitest";
import { roleHasPermission, rolesHavePermission } from "@/lib/auth/permissions";

describe("role permission matrix", () => {
  it("enforces separation of duties", () => {
    expect(roleHasPermission("sales", "quotes.approve")).toBe(false);
    expect(roleHasPermission("sales", "payments.verify")).toBe(false);
    expect(roleHasPermission("sales", "deliveries.complete")).toBe(false);
    expect(roleHasPermission("accounts", "quotes.create")).toBe(false);
    expect(roleHasPermission("store", "quotes.approve")).toBe(false);
    expect(roleHasPermission("store", "payments.record")).toBe(true);
    expect(roleHasPermission("store", "payments.verify")).toBe(false);
  });

  it("gives admin every permission", () => {
    expect(roleHasPermission("admin", "admin.manage")).toBe(true);
    expect(roleHasPermission("admin", "quotes.approve")).toBe(true);
  });

  it("combines extra hats", () => {
    expect(rolesHavePermission(["sales", "store"], "deliveries.complete")).toBe(
      true,
    );
    expect(rolesHavePermission(["sales", "store"], "quotes.create")).toBe(true);
    expect(rolesHavePermission(["sales", "store"], "quotes.approve")).toBe(false);
    expect(rolesHavePermission("sales", "deliveries.complete")).toBe(false);
  });
});
