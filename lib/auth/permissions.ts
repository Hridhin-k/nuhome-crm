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
  "stock.read",
  "stock.purchase",
  "stock.receive",
  "stock.sell",
  "stock.adjust",
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
    "stock.read",
    "stock.sell",
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
    "stock.read",
  ],
  procurement: [
    "customers.read",
    "orders.read",
    "orders.send_to_vendor",
    "fulfillment.update",
    "stock.read",
    "stock.purchase",
    "stock.receive",
  ],
  store: [
    "customers.read",
    "orders.read",
    "fulfillment.update",
    "payments.record",
    "deliveries.complete",
    "stock.read",
    "stock.receive",
    "stock.sell",
  ],
  operations: [
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
    "stock.read",
    "stock.purchase",
    "stock.receive",
    "stock.sell",
    "stock.adjust",
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

const PRODUCT_COST_ROLES: readonly AppRole[] = [
  "accounts",
  "procurement",
  "operations",
  "admin",
];

export function canSeeProductCost(roles: AppRole[] | AppRole) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((role) => PRODUCT_COST_ROLES.includes(role));
}
