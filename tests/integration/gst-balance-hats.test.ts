import { describe, expect, it } from "vitest";
import { lineGstAmount, lineTaxable, lineTotalWithGst } from "@/lib/gst";
import { linesFromQuoteItems } from "@/lib/quotes/lines";
import { calculateOutstanding, resolveDeliveryGate } from "@/lib/workflow/engine";
import { createQuoteSchema, customerSchema } from "@/lib/validation/workflow";
import { materialInputSchema, vendorInputSchema } from "@/lib/validation/admin";
import { navForRoles, overflowNavForRoles, roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { availableToSend, unaccountedQty } from "@/lib/workflow/fulfillment";

const UUID = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";

describe("GST, quote totals, and delivery gate", () => {
  it("sums exclusive GST lines into outstanding that unlocks only at zero", () => {
    const items = linesFromQuoteItems([
      {
        material_id: UUID,
        description: "Cabinet",
        quantity: 2,
        unit_price: 10_000,
        unit_cost: 4_000,
        discount: 500,
        tax: 0,
        gst_rate: 18,
      },
      {
        material_id: UUID_B,
        description: "Handle",
        quantity: 4,
        unit_price: 250,
        unit_cost: 80,
        discount: 0,
        tax: 0,
        gst_rate: 18,
      },
    ]);

    const total = items.reduce(
      (sum, line) =>
        sum + lineTotalWithGst(line.quantity, line.unit_price, line.discount, line.gst_rate),
      0,
    );
    const taxable = items.reduce(
      (sum, line) => sum + lineTaxable(line.quantity, line.unit_price, line.discount),
      0,
    );
    const gst = items.reduce(
      (sum, line) =>
        sum + lineGstAmount(line.quantity, line.unit_price, line.discount, line.gst_rate),
      0,
    );

    expect(taxable).toBe(20_500);
    expect(gst).toBe(3_690);
    expect(total).toBe(24_190);

    expect(createQuoteSchema.parse({ customer_id: UUID, items }).items).toHaveLength(2);

    const afterAdvance = calculateOutstanding(total, 10_000);
    expect(afterAdvance.outstanding).toBe(14_190);
    expect(resolveDeliveryGate(afterAdvance.outstanding)).toBe("order_on_hold");
    expect(resolveDeliveryGate(calculateOutstanding(total, total).outstanding)).toBe(
      "delivery_unlocked",
    );
  });

  it("splits a line across vendors and writes off a shortage so GRN can close", () => {
    const item = { quantity: 10, allocated: 0, quantity_written_off: 0, quantity_received: 0 };
    expect(availableToSend(item)).toBe(10);
    const vendorA = 6;
    const vendorB = 3;
    const holdBack = 1;
    expect(vendorA + vendorB + holdBack).toBe(10);
    expect(availableToSend({ ...item, allocated: vendorA + vendorB, quantity_written_off: holdBack })).toBe(
      0,
    );
    expect(
      unaccountedQty({
        quantity: 10,
        quantity_received: 8,
        quantity_written_off: 2,
      }),
    ).toBe(0);
  });
});

describe("customer, vendor, material, and extra-hat nav together", () => {
  it("keeps billing distinct from site and accepts a GSTIN", () => {
    const customer = customerSchema.parse({
      name: "Priya Nair",
      phone: "9876543210",
      gstin: "32AAAAA0000A1Z5",
      billing_address: "Ernakulam showroom",
      site_address: "Kakkanad site",
    });
    expect(customer.billing_address).not.toBe(customer.site_address);
  });

  it("accepts a vendor with contacts and a GST-rated material", () => {
    expect(
      vendorInputSchema.parse({
        name: "Kerala Woods",
        contacts: [{ name: "Anil", phone: "9876543210" }],
      }).name,
    ).toBe("Kerala Woods");
    expect(
      materialInputSchema.parse({
        name: "Cabinet",
        sku: "CAB-1",
        category: "Kitchen",
        sell_price: 10000,
        cost: 4000,
        hsn_code: "9403",
        gst_rate: 18,
        warranty_months: 12,
      }).gst_rate,
    ).toBe(18);
  });

  it("parks Delivery Ready under More when Sales wears a Saturday hat", () => {
    expect(roleLabels(["sales", "store"])).toBe("Sales + Delivery");
    expect(navForRoles(["sales", "store"], "sales").map((item) => item.href)).not.toContain(
      "/ready",
    );
    expect(overflowNavForRoles(["sales", "store"], "sales").map((item) => item.href)).toEqual([
      "/ready",
    ]);
    expect(rolesHavePermission(["sales", "store"], "deliveries.complete")).toBe(true);
    expect(rolesHavePermission(["sales", "store"], "quotes.approve")).toBe(false);
  });
});
