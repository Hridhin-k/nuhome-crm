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
  "catalog.manage",
  "staff.manage",
  "leads.manage",
  "reports.read",
  "deliveries.credit_approve",
  "vendors.quote_approve",
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
    "deliveries.complete",
  ],
  accounts: [
    "customers.read",
    "quotes.approve",
    "quotes.reject",
    "quotes.read_margin",
    "payments.verify",
    "orders.read",
    "orders.send_to_vendor",
    "fulfillment.update",
    "vendors.quote_approve",
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
  super_accounts: [
    "customers.read",
    "customers.write",
    "quotes.approve",
    "quotes.reject",
    "quotes.read_margin",
    "payments.verify",
    "orders.read",
    "orders.send_to_vendor",
    "fulfillment.update",
    "catalog.manage",
    "staff.manage",
    "leads.manage",
    "reports.read",
    "deliveries.credit_approve",
    "vendors.quote_approve",
  ],
  admin: [...PERMISSIONS],
};

export function roleHasPermission(role: AppRole, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function rolesHavePermission(
  roles: AppRole[] | AppRole,
  permission: Permission,
) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) => roleHasPermission(role, permission));
}
