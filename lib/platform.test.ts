import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isLocalHostName,
  isLocalSiteUrl,
  resolveCustomerSiteUrl,
} from "@/lib/site-url-shared";
import { resolveSiteUrl } from "@/lib/site-url";
import { humanizeError, isNavigationError, rethrowNavigationError } from "@/lib/api/errors";
import { navChrome } from "@/lib/auth/nav-chrome";
import { generateTempPassword, parseAppRole } from "@/lib/auth/roles";
import { parseWorkflowStatus, WORKFLOW_STATUSES } from "@/lib/workflow/types";
import { parseExportKind } from "@/lib/reports/load-export";
import { navForRole, navForRoles, overflowNavForRoles, roleLabel } from "@/lib/auth/nav";
import { APP_ROLES } from "@/lib/workflow/types";

describe("site URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("treats localhost, loopback, and .local as local", () => {
    expect(isLocalHostName("localhost:3000")).toBe(true);
    expect(isLocalHostName("127.0.0.1")).toBe(true);
    expect(isLocalSiteUrl("http://nuhome.local")).toBe(true);
    expect(isLocalSiteUrl("https://nuhome-crm.vercel.app")).toBe(false);
    expect(isLocalSiteUrl("not a url")).toBe(false);
  });

  it("never puts a localhost origin on a customer WhatsApp link when a public URL is set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_CUSTOMER_APP_URL", "https://quotes.nuhome.in/");
    expect(
      resolveCustomerSiteUrl({ host: "localhost:3000", forwardedProto: "http" }),
    ).toBe("https://quotes.nuhome.in");
  });

  it("falls back to the request host, using http only for local hosts", () => {
    expect(resolveCustomerSiteUrl({})).toBe("http://localhost:3000");
    expect(
      resolveSiteUrl({ host: "nuhome-crm.vercel.app", forwardedProto: "https" }),
    ).toBe("https://nuhome-crm.vercel.app");
    expect(resolveSiteUrl({ host: "localhost:3000" })).toBe("http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nuhome-crm.vercel.app/");
    expect(resolveSiteUrl({ host: "localhost:3000" })).toBe("https://nuhome-crm.vercel.app");
  });
});

describe("humanizeError", () => {
  it("maps duplicate phone, permission, transition, and SoD errors", () => {
    expect(humanizeError(new Error("customers_phone_normalized unique"))).toBe(
      "A customer with this phone number already exists.",
    );
    expect(humanizeError(new Error("duplicate key value"))).toBe("That record already exists.");
    expect(humanizeError(new Error("42501 not authenticated"))).toBe(
      "You don’t have permission to do that.",
    );
    expect(humanizeError(new Error("Invalid transition: a → b"))).toBe(
      "This order isn’t in the right stage for that action.",
    );
    expect(humanizeError(new Error("You cannot approve your own quote"))).toBe(
      "You can’t approve or reject your own quote.",
    );
    expect(humanizeError(new Error("You cannot verify a payment you recorded"))).toBe(
      "You can’t verify or reject a payment you recorded.",
    );
    expect(humanizeError(new Error("Rejection reason is required"))).toBe(
      "Please add a reason before sending this back.",
    );
    expect(
      humanizeError(new Error("Delivery blocked. Outstanding balance is 50")),
    ).toBe("Delivery blocked. Outstanding balance is 50");
    expect(humanizeError("not an error")).toBe("Something went wrong");
  });

  it("rethrows Next.js navigation errors and ignores others", () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;/" });
    expect(isNavigationError(redirect)).toBe(true);
    expect(isNavigationError(new Error("boom"))).toBe(false);
    expect(() => rethrowNavigationError(redirect)).toThrow();
    expect(() => rethrowNavigationError(new Error("boom"))).not.toThrow();
  });
});

describe("navChrome", () => {
  it("titles list, detail, revise, and walk-in screens", () => {
    expect(navChrome("/home")).toEqual({ title: "Nuhome", backHref: null });
    expect(navChrome("/quotes")).toEqual({ title: "Nuhome", backHref: null });
    expect(navChrome("/quotes/abc")).toEqual({ title: "Quote", backHref: "/quotes" });
    expect(navChrome("/quotes/abc/revise")).toEqual({
      title: "Correct quote",
      backHref: "/quotes/abc",
    });
    expect(navChrome("/quotes/new")).toEqual({ title: "Nuhome", backHref: null });
    expect(navChrome("/orders/abc")).toEqual({ title: "Order", backHref: "/orders" });
    expect(navChrome("/customers/abc")).toEqual({ title: "Customer", backHref: "/customers" });
    expect(navChrome("/fulfillment/abc")).toEqual({
      title: "Fulfillment",
      backHref: "/fulfillment",
    });
    expect(navChrome("/approvals/abc")).toEqual({ title: "Quote", backHref: "/approvals" });
    expect(navChrome("/walk-in")).toEqual({ title: "Customer walk-in", backHref: "/home" });
    expect(navChrome("/unknown")).toEqual({ title: "Nuhome", backHref: null });
  });
});

describe("roles, statuses, and export kinds", () => {
  it("parses every app role and rejects junk", () => {
    for (const role of APP_ROLES) {
      expect(parseAppRole(role)).toBe(role);
      expect(parseAppRole(role.toUpperCase())).toBe(role);
    }
    expect(parseAppRole("delivery")).toBe("store");
    expect(parseAppRole("")).toBeNull();
    expect(parseAppRole(null)).toBeNull();
    expect(parseAppRole("  manager  ")).toBeNull();
  });

  it("generates a 12-character temp password without ambiguous characters", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(passwords.size).toBe(20);
    for (const password of passwords) {
      expect(password).toHaveLength(12);
      expect(password).not.toMatch(/[IlO01]/);
    }
  });

  it("parses every workflow status and unknown values", () => {
    for (const status of WORKFLOW_STATUSES) {
      expect(parseWorkflowStatus(status)).toBe(status);
    }
    expect(parseWorkflowStatus("nope")).toBeUndefined();
    expect(parseWorkflowStatus(null)).toBeUndefined();
  });

  it("parses every report export kind", () => {
    for (const kind of ["audit", "floor", "collections", "sitting", "aging", "queues"] as const) {
      expect(parseExportKind(kind)).toBe(kind);
    }
    expect(parseExportKind("nope")).toBeNull();
    expect(parseExportKind(null)).toBeNull();
  });
});

describe("nav for every role", () => {
  it("gives each role a primary bar that starts at Home and ends in More", () => {
    for (const role of APP_ROLES) {
      const items = navForRole(role);
      expect(items.length).toBeGreaterThanOrEqual(4);
      expect(items.length).toBeLessThanOrEqual(5);
      expect(items[0].href).toBe("/home");
      expect(items.at(-1)?.href).toBe("/more");
      expect(roleLabel(role).length).toBeGreaterThan(0);
    }
    expect(roleLabel("store")).toBe("Delivery");
    expect(navForRoles(["admin"], "admin").map((item) => item.href)).toEqual([
      "/home",
      "/users",
      "/orders",
      "/reports",
      "/more",
    ]);
    expect(overflowNavForRoles(["admin", "sales"], "admin").map((item) => item.href)).toEqual([
      "/customers",
      "/quotes",
    ]);
  });
});
