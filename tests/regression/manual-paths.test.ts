import { describe, expect, it } from "vitest";
import {
  assertCanApproveQuote,
  assertCanDeliver,
  assertCanRejectPayment,
  assertCanRejectQuote,
  assertCanSendQuote,
  assertCanVerifyPayment,
  assertPaymentAmount,
  calculateOutstanding,
  resolveDeliveryGate,
  resolvePaymentVerificationNext,
  WorkflowError,
} from "@/lib/workflow/engine";
import { assertTransition, canSendQuoteToCustomer, canTransition } from "@/lib/workflow/transitions";
import { canRecordPayment } from "@/lib/workflow/payment-recording";
import { canCancelJob } from "@/lib/workflow/cancel";
import {
  availableToSend,
  isVendorOrderOverdue,
  unaccountedQty,
} from "@/lib/workflow/fulfillment";
import { nextRequiredAction } from "@/lib/workflow/next-action";
import { notificationHref, type AppNotification } from "@/lib/notifications/types";
import { roleHasPermission, rolesHavePermission } from "@/lib/auth/permissions";
import { navForRole, navForRoles, overflowNavForRoles, roleLabel } from "@/lib/auth/nav";
import { publicQuoteUrl } from "@/lib/quotes/public-url";
import { lineTotalWithGst } from "@/lib/gst";
import {
  cancelJobSchema,
  createQuoteSchema,
  customerSchema,
  recordPaymentSchema,
  rejectPaymentSchema,
  rejectQuoteSchema,
} from "@/lib/validation/workflow";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
} from "@/lib/validation/auth";
import {
  companySettingsSchema,
  installationSchema,
  uploadAttachmentSchema,
  warrantySchema,
} from "@/lib/validation/documents";
import {
  createStaffSchema,
  materialInputSchema,
  updateStaffSchema,
  vendorInputSchema,
} from "@/lib/validation/admin";
import { matchesSearch, parseYmd, sanitizeSearch } from "@/lib/search";
import { parseCsv } from "@/lib/csv";
import { parseAppRole } from "@/lib/auth/roles";
import { floorHref } from "@/lib/workflow/status-buckets";
import { APP_ROLES, type WorkflowStatus } from "@/lib/workflow/types";

const SALES = "sales-1";
const ACCOUNTS = "accounts-1";
const UUID = "550e8400-e29b-41d4-a716-446655440000";

function notice(type: string, payload: Record<string, unknown> = {}): AppNotification {
  return {
    id: "n",
    type,
    title: type,
    body: null,
    payload,
    read_at: null,
    created_at: "2026-08-16T00:00:00.000Z",
  };
}

function walk(path: WorkflowStatus[]) {
  for (let i = 0; i < path.length - 1; i += 1) {
    assertTransition(path[i], path[i + 1]);
  }
}

describe("PATH A — happy path full pay end to end", () => {
  it("draft → approve → send → full pay → vendor → receive → unlock → deliver → close", () => {
    const total = lineTotalWithGst(1, 100_000, 0, 18);
    walk([
      "quote_draft",
      "quote_pending_accounts",
      "quote_approved",
      "quote_sent_to_customer",
      "payment_pending_verification",
    ]);
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: false,
        outstanding: 0,
        currentStatus: "payment_pending_verification",
        itemsFullyReceived: false,
      }),
    ).toBe("order_active");
    walk([
      "order_active",
      "sent_to_vendor",
      "vendor_dispatched",
      "items_received",
      "delivery_pending_payment",
      "delivery_unlocked",
      "delivered",
      "closed",
    ]);
    expect(calculateOutstanding(total, total).outstanding).toBe(0);
    expect(() =>
      assertCanDeliver({
        actorRole: "store",
        status: "delivery_unlocked",
        outstanding: 0,
        itemsFullyReceived: true,
      }),
    ).not.toThrow();
  });
});

describe("PATH B — reject quote + revise + advance + hold", () => {
  it("returns a rejected quote to draft, then holds delivery on an unpaid remainder", () => {
    expect(() =>
      assertCanRejectQuote({
        actorId: ACCOUNTS,
        actorRole: "accounts",
        quoteCreatedBy: SALES,
        status: "quote_pending_accounts",
        reason: "Discount too high",
      }),
    ).not.toThrow();
    rejectQuoteSchema.parse({ quote_id: UUID, reason: "Discount too high" });
    walk(["quote_pending_accounts", "quote_rejected", "quote_draft", "quote_pending_accounts"]);
    expect(canSendQuoteToCustomer("quote_rejected")).toBe(false);

    walk(["quote_approved", "quote_draft"]);
    expect(() =>
      assertCanSendQuote({ actorRole: "sales", status: "quote_draft" }),
    ).toThrow(WorkflowError);

    const outstanding = calculateOutstanding(118_000, 18_000).outstanding;
    expect(outstanding).toBe(100_000);
    expect(resolveDeliveryGate(outstanding)).toBe("order_on_hold");
    walk(["items_received", "delivery_pending_payment", "order_on_hold"]);
  });
});

describe("PATH C — nil (credit) then later real payment", () => {
  it("activates on nil, then holds after goods until a real payment clears the balance", () => {
    assertPaymentAmount("nil", 0);
    recordPaymentSchema.parse({ quote_id: UUID, kind: "nil", amount: 0 });
    expect(() => assertPaymentAmount("nil", 1)).toThrow();
    const total = 50_000;
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: false,
        outstanding: total,
        currentStatus: "payment_pending_verification",
        itemsFullyReceived: false,
      }),
    ).toBe("order_active");
    expect(resolveDeliveryGate(total)).toBe("order_on_hold");
    expect(
      resolvePaymentVerificationNext({
        alreadyActivated: true,
        outstanding: 0,
        currentStatus: "order_on_hold",
        itemsFullyReceived: true,
      }),
    ).toBe("delivery_unlocked");
  });
});

describe("PATH D — installment while the job is with the vendor", () => {
  it("lets Sales record a further advance on active / vendor / dispatched / received", () => {
    for (const status of [
      "order_active",
      "sent_to_vendor",
      "vendor_dispatched",
      "items_received",
    ] as const) {
      expect(
        canRecordPayment({
          status,
          payments: [{ status: "verified" }],
          outstanding: 40_000,
        }),
      ).toBe(true);
      expect(
        resolvePaymentVerificationNext({
          alreadyActivated: true,
          outstanding: 20_000,
          currentStatus: status,
          itemsFullyReceived: false,
        }),
      ).toBe(status);
    }
  });
});

describe("PATH E — cancel a dead quote / order", () => {
  it("enforces who can cancel at each stage and requires a reason", () => {
    cancelJobSchema.parse({ quote_id: UUID, reason: "Customer dropped" });
    expect(canCancelJob({ quoteStatus: "quote_draft", roles: "sales" })).toBe(true);
    expect(
      canCancelJob({ quoteStatus: "quote_pending_accounts", roles: "accounts" }),
    ).toBe(true);
    expect(canCancelJob({ quoteStatus: "quote_approved", roles: "accounts" })).toBe(false);
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "order_active",
        roles: "procurement",
      }),
    ).toBe(true);
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "order_active",
        roles: "store",
      }),
    ).toBe(false);
    expect(
      canCancelJob({
        quoteStatus: "quote_sent_to_customer",
        orderStatus: "delivered",
        roles: "admin",
      }),
    ).toBe(false);
    walk(["quote_draft", "cancelled"]);
    walk(["order_active", "cancelled"]);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canRecordPayment({ status: "cancelled", payments: [], outstanding: 1 })).toBe(
      false,
    );
  });
});

describe("PATH F — split vendors, partial GRN, shortage, overdue", () => {
  it("holds qty back, writes off shortage, and flags an overdue in-flight batch", () => {
    expect(availableToSend({ quantity: 10, allocated: 6, quantity_written_off: 1 })).toBe(3);
    expect(
      unaccountedQty({ quantity: 10, quantity_received: 7, quantity_written_off: 3 }),
    ).toBe(0);
    expect(
      isVendorOrderOverdue(
        { expected_delivery_at: "2026-08-01", status: "sent" },
        "2026-08-17",
      ),
    ).toBe(true);
    walk(["sent_to_vendor", "items_received"]);
  });
});

describe("PATH G — payment rejected, then re-recorded", () => {
  it("blocks verify-own-payment and reopens recording after reject", () => {
    expect(() =>
      assertCanVerifyPayment({
        actorId: ACCOUNTS,
        actorRole: "accounts",
        recordedBy: ACCOUNTS,
      }),
    ).toThrow(/you recorded/);
    assertCanRejectPayment({
      actorId: ACCOUNTS,
      actorRole: "accounts",
      recordedBy: SALES,
    });
    rejectPaymentSchema.parse({ payment_id: UUID, notes: "Wrong UPI ref" });
    expect(
      canRecordPayment({
        status: "payment_pending_verification",
        payments: [{ status: "rejected" }],
        outstanding: 10_000,
      }),
    ).toBe(true);
    expect(
      nextRequiredAction({
        status: "payment_pending_verification",
        role: "sales",
        payments: [{ status: "rejected" }],
        orderId: "o1",
      }).cta,
    ).toBe("Record payment");
  });
});

describe("PATH H — customer GST / billing vs site / files", () => {
  it("stores GSTIN, distinct addresses, and job-file kinds", () => {
    const customer = customerSchema.parse({
      name: "Priya Nair",
      gstin: "32AAAAA0000A1Z5",
      billing_address: "Bill-to Kochi",
      site_address: "Site Kakkanad",
    });
    expect(customer.gstin).toHaveLength(15);
    expect(customer.billing_address).not.toBe(customer.site_address);
    for (const kind of ["measurement", "drawing", "photo", "file"] as const) {
      uploadAttachmentSchema.parse({
        entity_type: "quote",
        entity_id: UUID,
        kind,
        return_to: "/quotes/1",
      });
    }
  });
});

describe("PATH I — tax invoice + installation + warranty / AMC", () => {
  it("accepts company GST settings, a site date, and warranty or AMC", () => {
    companySettingsSchema.parse({
      legal_name: "Nuhome Interiors",
      gstin: "32AAAAA0000A1Z5",
      default_gst_rate: 18,
    });
    installationSchema.parse({
      order_id: UUID,
      scheduled_on: "2026-08-20",
      status: "scheduled",
    });
    warrantySchema.parse({
      order_id: UUID,
      kind: "warranty",
      starts_on: "2026-08-17",
      ends_on: "2027-08-17",
    });
    warrantySchema.parse({
      order_id: UUID,
      kind: "amc",
      starts_on: "2026-08-17",
      ends_on: "2027-08-17",
    });
    expect(
      nextRequiredAction({
        status: "closed",
        role: "sales",
        orderId: "o1",
        hasInstallation: false,
      }).cta,
    ).toBe("Schedule");
  });
});

describe("PATH J — public quotation + WhatsApp", () => {
  it("builds a public /q/ link on a non-localhost origin", () => {
    expect(publicQuoteUrl("https://nuhome-crm.vercel.app", "tok_live")).toBe(
      "https://nuhome-crm.vercel.app/q/tok_live",
    );
    expect(publicQuoteUrl("https://nuhome-crm.vercel.app", "tok_live")).not.toContain(
      "localhost",
    );
  });
});

describe("PATH K — vendors, materials, company", () => {
  it("validates vendor contacts, material sheet, and inactive flags", () => {
    vendorInputSchema.parse({
      name: "Kerala Woods",
      is_active: false,
      contacts: [{ name: "Anil" }],
    });
    materialInputSchema.parse({
      name: "Cabinet",
      sku: "CAB-1",
      category: "Kitchen",
      sell_price: 12000,
      cost: 5000,
      gst_rate: 18,
    });
    expect(() => materialInputSchema.parse({ name: "X", sku: "", category: "K", sell_price: 1, cost: 1 })).toThrow();
  });
});

describe("PATH L — users, extra hats, cover, CSV, passwords", () => {
  it("covers login, forgot/change password, staff hats, and CSV import aliases", () => {
    loginSchema.parse({ email: "sales@nuhome.demo", password: "password123" });
    expect(() =>
      loginSchema.parse({ email: "sales@nuhome.demo", password: "wrong" }),
    ).toThrow();
    forgotPasswordSchema.parse({ email: "sales@nuhome.demo" });
    changePasswordSchema.parse({
      current_password: "password123",
      new_password: "newpass12",
      confirm_password: "newpass12",
    });
    createStaffSchema.parse({
      email: "new@nuhome.demo",
      full_name: "New Sales",
      role: "sales",
      password: "password123",
    });
    updateStaffSchema.parse({
      user_id: UUID,
      full_name: "Sales Demo",
      role: "sales",
      extra_roles: ["store"],
      is_active: true,
    });
    expect(rolesHavePermission(["sales", "store"], "deliveries.complete")).toBe(true);
    expect(overflowNavForRoles(["sales", "store"], "sales").map((item) => item.href)).toEqual([
      "/ready",
    ]);
    const { rows } = parseCsv(
      "email,full_name,role\nsales@nuhome.demo,Sales Demo,sales\n",
    );
    expect(rows[0].role).toBe("sales");
  });
});

describe("PATH M — lists, search, floor book, reports", () => {
  it("matches quote number / phone / name and deep-links the floor board", () => {
    expect(matchesSearch(["NH-1042", "Priya", "9876543210"], "1042")).toBe(true);
    expect(matchesSearch(["NH-1042"], "%")).toBe(true);
    expect(sanitizeSearch("%NH_1042%")).toBe("NH1042");
    expect(parseYmd("2026-08-01")).toBe("2026-08-01");
    expect(floorHref("quote_pending_accounts")).toContain("/quotes?");
    expect(floorHref("sent_to_vendor")).toBe("/orders?status=sent_to_vendor");
    expect(floorHref("cancelled")).toContain("group=closed");
  });
});

describe("PATH N — each role's Home", () => {
  it("gives every role a Home nav item and a next action on a live job", () => {
    for (const role of APP_ROLES) {
      expect(navForRole(role)[0].href).toBe("/home");
      expect(roleLabel(role).length).toBeGreaterThan(0);
      const action = nextRequiredAction({
        status: "quote_pending_accounts",
        role,
        quoteId: "q1",
      });
      expect(action.title.length).toBeGreaterThan(0);
    }
    expect(nextRequiredAction({ status: "order_active", role: "procurement" }).cta).toBe(
      "Send to vendor",
    );
    expect(nextRequiredAction({ status: "delivery_unlocked", role: "store" }).cta).toBe(
      "Complete delivery",
    );
    expect(nextRequiredAction({ status: "quote_approved", role: "sales" }).cta).toBe("Send");
    expect(
      nextRequiredAction({
        status: "payment_pending_verification",
        role: "accounts",
        payments: [{ status: "pending" }],
      }).cta,
    ).toBe("Review");
    expect(navForRoles(["admin"], "admin").some((item) => item.href === "/reports")).toBe(
      true,
    );
  });
});

describe("PATH O — live refresh + every bell type", () => {
  it("routes every floor notification type to the next desk", () => {
    expect(notificationHref(notice("QUOTE_SUBMITTED", { quote_id: UUID }))).toBe(
      `/approvals/${UUID}`,
    );
    expect(notificationHref(notice("QUOTE_APPROVED", { quote_id: UUID }))).toBe(
      `/quotes/${UUID}`,
    );
    expect(notificationHref(notice("QUOTE_REJECTED", { quote_id: UUID }))).toBe(
      `/quotes/${UUID}`,
    );
    expect(notificationHref(notice("PAYMENT_RECORDED"))).toBe("/payments");
    expect(notificationHref(notice("ORDER_ACTIVATED", { order_id: UUID }))).toBe(
      `/fulfillment/${UUID}`,
    );
    expect(notificationHref(notice("VENDOR_DISPATCHED", { order_id: UUID }))).toBe(
      `/orders/${UUID}`,
    );
    expect(notificationHref(notice("ORDER_PLACED_ON_HOLD", { order_id: UUID }))).toBe(
      `/orders/${UUID}`,
    );
    expect(notificationHref(notice("DELIVERY_UNLOCKED", { order_id: UUID }))).toBe(
      `/orders/${UUID}`,
    );
    expect(notificationHref(notice("ORDER_DELIVERED", { order_id: UUID }))).toBe(
      `/orders/${UUID}`,
    );
    expect(notificationHref(notice("QUOTE_CANCELLED", { quote_id: UUID }))).toBe(
      `/quotes/${UUID}`,
    );
    expect(notificationHref(notice("ORDER_CANCELLED", { order_id: UUID }))).toBe(
      `/orders/${UUID}`,
    );
  });
});

describe("PATH P — negative / permission checks", () => {
  it("blocks every SoD and stage skip the floor is not allowed to take", () => {
    expect(roleHasPermission("sales", "quotes.approve")).toBe(false);
    expect(roleHasPermission("sales", "payments.verify")).toBe(false);
    expect(roleHasPermission("accounts", "payments.record")).toBe(false);
    expect(roleHasPermission("store", "quotes.approve")).toBe(false);
    expect(parseAppRole("delivery")).toBe("store");

    expect(() =>
      assertCanApproveQuote({
        actorId: SALES,
        actorRole: "sales",
        quoteCreatedBy: "other",
        status: "quote_pending_accounts",
      }),
    ).toThrow(/permission/);
    expect(() =>
      assertCanApproveQuote({
        actorId: ACCOUNTS,
        actorRole: "accounts",
        quoteCreatedBy: ACCOUNTS,
        status: "quote_pending_accounts",
      }),
    ).toThrow(/own quote/);
    expect(() =>
      assertCanSendQuote({ actorRole: "sales", status: "quote_rejected" }),
    ).toThrow();
    expect(() => assertTransition("items_received", "delivered")).toThrow();
    expect(() => assertTransition("quote_draft", "quote_approved")).toThrow();
    expect(() =>
      assertCanDeliver({
        actorRole: "store",
        status: "items_received",
        outstanding: 0,
        itemsFullyReceived: true,
      }),
    ).toThrow(/locked/);
    expect(() =>
      assertCanDeliver({
        actorRole: "sales",
        status: "delivery_unlocked",
        outstanding: 0,
        itemsFullyReceived: true,
      }),
    ).toThrow(/permission/);
    expect(() =>
      createQuoteSchema.parse({ customer_id: UUID, items: [] }),
    ).toThrow();
    expect(() =>
      recordPaymentSchema.parse({ quote_id: UUID, kind: "full", amount: 0 }),
    ).toThrow();
  });
});

describe("PART 0 — login, nav, role gates", () => {
  it("validates demo login and keeps each role on its own bar", () => {
    loginSchema.parse({ email: "sales@nuhome.demo", password: "password123" });
    expect(() =>
      loginSchema.parse({ email: "sales@nuhome.demo", password: "" }),
    ).toThrow();
    expect(navForRole("sales").map((item) => item.href)).toEqual([
      "/home",
      "/customers",
      "/quotes",
      "/orders",
      "/more",
    ]);
    expect(navForRole("accounts").map((item) => item.href)).toContain("/approvals");
    expect(navForRole("procurement").map((item) => item.href)).toContain("/fulfillment");
    expect(navForRole("store").map((item) => item.href)).toContain("/ready");
    expect(navForRole("admin").map((item) => item.href)).toContain("/users");
    expect(roleHasPermission("sales", "admin.manage")).toBe(false);
    expect(roleHasPermission("admin", "admin.manage")).toBe(true);
  });
});
