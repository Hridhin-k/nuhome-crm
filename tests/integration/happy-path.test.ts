import { describe, expect, it } from "vitest";
import {
  assertCanApproveQuote,
  assertCanDeliver,
  assertCanSendQuote,
  assertCanVerifyPayment,
  assertPaymentAmount,
  calculateOutstanding,
  resolveDeliveryGate,
  resolvePaymentVerificationNext,
  WorkflowError,
} from "@/lib/workflow/engine";
import { assertTransition, canTransition } from "@/lib/workflow/transitions";
import { canRecordPayment } from "@/lib/workflow/payment-recording";
import {
  availableToSend,
  unaccountedQty,
  vendorBatchStep,
} from "@/lib/workflow/fulfillment";
import { groupLinesByVendor } from "@/lib/workflow/vendor-split";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { remainingPaymentKinds } from "@/lib/payments/reference";
import { lineTotalWithGst } from "@/lib/gst";
import {
  allocateVendorsSchema,
  decideVendorQuoteSchema,
  recordPaymentSchema,
  recordVendorPaymentSchema,
  saveVendorQuoteSchema,
} from "@/lib/validation/workflow";
import type { WorkflowStatus } from "@/lib/workflow/types";

const SALES = "sales-1";
const ACCOUNTS = "accounts-1";
const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const ITEM = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function canDispatchVendor(commercial: string) {
  return commercial === "vendor_paid";
}

describe("happy path by role", () => {
  it("Sales quotes and pays; Accounts fulfills; Sales delivers", () => {
    const total = lineTotalWithGst(2, 50_000, 0, 18);
    let status: WorkflowStatus = "quote_draft";
    const payments: { kind: string; status: string; recordedBy: string; amount: number }[] = [];
    let verified = 0;
    let activated = false;
    let commercial = "pending_quote";
    let vendorPhysical = "draft";

    expect(rolesHavePermission("sales", "quotes.create")).toBe(true);
    expect(rolesHavePermission("sales", "quotes.approve")).toBe(false);
    expect(rolesHavePermission("accounts", "quotes.approve")).toBe(true);

    assertTransition(status, "quote_pending_accounts");
    status = "quote_pending_accounts";

    expect(() =>
      assertCanApproveQuote({
        actorId: SALES,
        actorRole: "sales",
        quoteCreatedBy: SALES,
        status,
      }),
    ).toThrow(WorkflowError);

    assertCanApproveQuote({
      actorId: ACCOUNTS,
      actorRole: "accounts",
      quoteCreatedBy: SALES,
      status,
    });
    status = "quote_approved";

    assertCanSendQuote({ actorRole: "sales", status });
    expect(rolesHavePermission("accounts", "quotes.send_to_customer")).toBe(false);
    status = "quote_sent_to_customer";

    expect(
      canRecordPayment({ status, payments, outstanding: total }),
    ).toBe(true);
    expect(remainingPaymentKinds(payments)).toEqual(["advance", "full", "nil"]);
    assertPaymentAmount("full", total);
    recordPaymentSchema.parse({
      quote_id: UUID,
      kind: "full",
      amount: total,
      method: "upi",
      reference: "UTR-HAPPY-1",
    });
    payments.push({
      kind: "full",
      status: "pending",
      recordedBy: SALES,
      amount: total,
    });
    status = "payment_pending_verification";

    expect(() =>
      assertCanVerifyPayment({
        actorId: SALES,
        actorRole: "sales",
        recordedBy: SALES,
      }),
    ).toThrow(WorkflowError);
    assertCanVerifyPayment({
      actorId: ACCOUNTS,
      actorRole: "accounts",
      recordedBy: SALES,
    });
    payments[0].status = "verified";
    verified = total;
    status = resolvePaymentVerificationNext({
      alreadyActivated: activated,
      outstanding: calculateOutstanding(total, verified).outstanding,
      currentStatus: status,
      itemsFullyReceived: false,
    });
    activated = true;
    expect(status).toBe("order_active");
    expect(calculateOutstanding(total, verified).outstanding).toBe(0);

    expect(rolesHavePermission("sales", "orders.send_to_vendor")).toBe(false);
    expect(rolesHavePermission("accounts", "orders.send_to_vendor")).toBe(true);
    expect(rolesHavePermission("accounts", "vendors.quote_approve")).toBe(true);

    const split = groupLinesByVendor([
      { order_item_id: ITEM, vendor_id: UUID, quantity: 2, unit_cost: 12_000.5 },
    ]);
    expect(split).toHaveLength(1);
    expect(split[0].quote_amount).toBe(24001);
    allocateVendorsSchema.parse({
      order_id: UUID,
      order_number: "ORD-1001",
      items: [
        {
          order_item_id: ITEM,
          vendor_id: UUID,
          quantity: 2,
          unit_cost: 12_000.5,
        },
      ],
    });
    expect(availableToSend({ quantity: 2, allocated: 2 })).toBe(0);

    saveVendorQuoteSchema.parse({
      vendor_order_id: UUID_B,
      quote_ref: "ORD-1001-VENDOR",
      quote_amount: 24001,
    });
    commercial = "quoted";
    expect(vendorBatchStep({ status: vendorPhysical, commercial_status: commercial })).toBe(
      "Quoted",
    );

    decideVendorQuoteSchema.parse({
      vendor_order_id: UUID_B,
      approve: true,
    });
    commercial = "quote_approved";

    vendorPhysical = "sent";
    status = "sent_to_vendor";

    expect(canDispatchVendor(commercial)).toBe(false);
    recordVendorPaymentSchema.parse({
      vendor_order_id: UUID_B,
      amount: 24001,
      method: "upi",
      reference: "V-UTR-88",
    });
    commercial = "vendor_paid";
    expect(canDispatchVendor(commercial)).toBe(true);

    assertTransition(status, "vendor_dispatched");
    status = "vendor_dispatched";
    vendorPhysical = "dispatched";

    expect(rolesHavePermission("accounts", "fulfillment.update")).toBe(true);
    expect(unaccountedQty({ quantity: 2, quantity_received: 0 })).toBe(2);
    status = "items_received";
    expect(
      unaccountedQty({ quantity: 2, quantity_received: 2, quantity_written_off: 0 }),
    ).toBe(0);

    assertTransition(status, "delivery_pending_payment");
    status = "delivery_pending_payment";
    expect(resolveDeliveryGate(0)).toBe("delivery_unlocked");
    status = "delivery_unlocked";

    expect(rolesHavePermission("accounts", "deliveries.complete")).toBe(false);
    expect(rolesHavePermission("sales", "deliveries.complete")).toBe(true);
    assertCanDeliver({
      actorRole: "sales",
      status,
      outstanding: 0,
      itemsFullyReceived: true,
    });
    expect(() =>
      assertCanDeliver({
        actorRole: "accounts",
        status,
        outstanding: 0,
        itemsFullyReceived: true,
      }),
    ).toThrow(WorkflowError);

    assertTransition(status, "delivered");
    status = "delivered";
    assertTransition(status, "closed");
    status = "closed";
    expect(canTransition("closed", "order_active")).toBe(false);
  });
});
