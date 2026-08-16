import type { AppRole } from "@/lib/workflow/types";

export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "people" | "quotes" | "orders" | "more" | "check" | "pay" | "truck" | "box" | "users" | "chart";
};

const NAV: Record<AppRole, NavItem[]> = {
  sales: [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/customers", label: "Customers", icon: "people" },
    { href: "/quotes", label: "Quotes", icon: "quotes" },
    { href: "/orders", label: "Orders", icon: "orders" },
    { href: "/more", label: "More", icon: "more" },
  ],
  accounts: [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/approvals", label: "Approvals", icon: "check" },
    { href: "/payments", label: "Payments", icon: "pay" },
    { href: "/orders", label: "Orders", icon: "orders" },
    { href: "/more", label: "More", icon: "more" },
  ],
  procurement: [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/orders", label: "Orders", icon: "orders" },
    { href: "/vendors", label: "Vendors", icon: "truck" },
    { href: "/fulfillment", label: "Fulfillment", icon: "box" },
    { href: "/more", label: "More", icon: "more" },
  ],
  store: [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/ready", label: "Ready", icon: "box" },
    { href: "/orders", label: "Orders", icon: "orders" },
    { href: "/more", label: "More", icon: "more" },
  ],
  admin: [
    { href: "/home", label: "Home", icon: "home" },
    { href: "/users", label: "Users", icon: "users" },
    { href: "/orders", label: "Orders", icon: "orders" },
    { href: "/reports", label: "Reports", icon: "chart" },
    { href: "/more", label: "More", icon: "more" },
  ],
};

export function navForRole(role: AppRole) {
  return NAV[role];
}

export function navForRoles(roles: AppRole[], primary: AppRole): NavItem[] {
  const uniqueRoles = [primary, ...roles.filter((role) => role !== primary)];
  const seen = new Set<string>();
  const merged: NavItem[] = [];
  for (const role of uniqueRoles) {
    for (const item of NAV[role]) {
      if (item.href === "/more" || seen.has(item.href)) continue;
      seen.add(item.href);
      merged.push(item);
    }
  }
  const more = NAV[primary].find((item) => item.href === "/more") ?? {
    href: "/more" as const,
    label: "More",
    icon: "more" as const,
  };
  if (merged.length <= 4) {
    return [...merged, more];
  }
  return [...merged.slice(0, 4), more];
}

export function overflowNavForRoles(
  roles: AppRole[],
  primary: AppRole,
): NavItem[] {
  const bar = new Set(navForRoles(roles, primary).map((item) => item.href));
  const uniqueRoles = [primary, ...roles.filter((role) => role !== primary)];
  const extras: NavItem[] = [];
  const seen = new Set<string>();
  for (const role of uniqueRoles) {
    for (const item of NAV[role]) {
      if (item.href === "/more" || bar.has(item.href) || seen.has(item.href)) {
        continue;
      }
      seen.add(item.href);
      extras.push(item);
    }
  }
  return extras;
}

export function roleLabel(role: AppRole) {
  switch (role) {
    case "sales":
      return "Sales";
    case "accounts":
      return "Accounts";
    case "procurement":
      return "Procurement";
    case "store":
      return "Delivery";
    case "admin":
      return "Admin";
  }
}

export function roleLabels(roles: AppRole[]) {
  const unique = [...new Set(roles)];
  return unique.map(roleLabel).join(" + ");
}
