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
