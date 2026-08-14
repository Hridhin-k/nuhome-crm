export function navChrome(pathname: string): {
  title: string;
  backHref: string | null;
} {
  if (pathname.startsWith("/walk-in")) {
    return { title: "Customer walk-in", backHref: "/home" };
  }

  const segments = pathname.split("/").filter(Boolean);
  const root = segments[0] ? `/${segments[0]}` : "/home";
  const id = segments[1];
  const isDetail = Boolean(id) && id !== "new";

  if (root === "/quotes" && segments[2] === "revise" && id) {
    return { title: "Correct quote", backHref: `/quotes/${id}` };
  }
  if (root === "/quotes" && isDetail) {
    return { title: "Quote", backHref: "/quotes" };
  }
  if (root === "/orders" && isDetail) {
    return { title: "Order", backHref: "/orders" };
  }
  if (root === "/customers" && isDetail) {
    return { title: "Customer", backHref: "/customers" };
  }
  if (root === "/fulfillment" && isDetail) {
    return { title: "Fulfillment", backHref: "/fulfillment" };
  }
  if (root === "/approvals" && isDetail) {
    return { title: "Quote", backHref: "/approvals" };
  }

  const listTitles: Record<string, string> = {
    "/home": "Nuhome",
    "/customers": "Customers",
    "/quotes": "Nuhome",
    "/orders": "Orders",
    "/approvals": "Nuhome",
    "/payments": "Nuhome",
    "/fulfillment": "Fulfillment",
    "/ready": "Ready",
    "/more": "Nuhome",
    "/users": "Users",
    "/vendors": "Vendors",
    "/materials": "Materials",
    "/reports": "Reports",
  };

  return { title: listTitles[root] ?? "Nuhome", backHref: null };
}
