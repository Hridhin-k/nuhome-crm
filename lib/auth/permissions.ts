import type { AppRole } from "@/lib/workflow/types";

export const PERMISSIONS = [
  "customers.read",
  "customers.write",
  "quotes.create",
  "quotes.revise",
  "quotes.submit",
  "quotes.approve",
  "quotes.reject",
  "quotes.send_to_customer",
  "quotes.read_margin",
  "payments.record",
  "payments.verify",
  "orders.read",
  "orders.send_to_vendor",
  "fulfillment.update",
  "deliveries.complete",
  "admin.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
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
    "deliveries.complete",
  ],
  admin: [...PERMISSIONS],
};

export function roleHasPermission(role: AppRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}
