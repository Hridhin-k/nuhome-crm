import { describe, expect, it } from "vitest";
import {
  createStaffSchema,
  materialInputSchema,
  updateStaffSchema,
  vendorInputSchema,
} from "@/lib/validation/admin";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createStaffSchema", () => {
  it("accepts every app role with a name, email, and password", () => {
    for (const role of ["sales", "accounts", "procurement", "store", "admin"] as const) {
      expect(
        createStaffSchema.parse({
          email: `${role}@nuhome.demo`,
          full_name: `${role} Demo`,
          role,
          password: "password123",
        }).role,
      ).toBe(role);
    }
  });

  it("rejects delivery as a stored role, a short password, and a blank name", () => {
    expect(() =>
      createStaffSchema.parse({
        email: "x@nuhome.demo",
        full_name: "X",
        role: "delivery",
        password: "password123",
      }),
    ).toThrow();
    expect(() =>
      createStaffSchema.parse({
        email: "x@nuhome.demo",
        full_name: "X",
        role: "sales",
        password: "short",
      }),
    ).toThrow();
    expect(() =>
      createStaffSchema.parse({
        email: "x@nuhome.demo",
        full_name: "  ",
        role: "sales",
        password: "password123",
      }),
    ).toThrow();
  });
});

describe("updateStaffSchema", () => {
  it("accepts extra hats and an inactive flag", () => {
    const parsed = updateStaffSchema.parse({
      user_id: UUID,
      full_name: "Sales Demo",
      role: "sales",
      extra_roles: ["store", "accounts"],
      is_active: false,
    });
    expect(parsed.extra_roles).toEqual(["store", "accounts"]);
    expect(parsed.is_active).toBe(false);
  });

  it("rejects an unknown extra hat", () => {
    expect(() =>
      updateStaffSchema.parse({
        user_id: UUID,
        full_name: "Sales Demo",
        role: "sales",
        extra_roles: ["manager"],
        is_active: true,
      }),
    ).toThrow();
  });
});

describe("vendorInputSchema", () => {
  it("requires a name and accepts contacts plus an inactive flag", () => {
    expect(() => vendorInputSchema.parse({ name: "" })).toThrow();
    const parsed = vendorInputSchema.parse({
      name: "Kerala Woods",
      email: "",
      is_active: false,
      contacts: [{ name: "Anil", phone: "9876543210", email: "" }],
    });
    expect(parsed.is_active).toBe(false);
    expect(parsed.contacts?.[0].name).toBe("Anil");
  });

  it("rejects a bad vendor or contact email", () => {
    expect(() => vendorInputSchema.parse({ name: "A", email: "nope" })).toThrow();
    expect(() =>
      vendorInputSchema.parse({
        name: "A",
        contacts: [{ name: "B", email: "nope" }],
      }),
    ).toThrow();
  });
});

describe("materialInputSchema", () => {
  it("requires name, SKU, category, and non-negative prices", () => {
    const parsed = materialInputSchema.parse({
      name: "Cabinet",
      sku: "CAB-1",
      category: "Kitchen",
      sell_price: 0,
      cost: 0,
      gst_rate: 18,
      warranty_months: 12,
    });
    expect(parsed.unit).toBe("pcs");
    expect(parsed.sell_price).toBe(0);
  });

  it("rejects negative prices, GST over 100, and warranty over 120 months", () => {
    const base = {
      name: "Cabinet",
      sku: "CAB-1",
      category: "Kitchen",
      sell_price: 100,
      cost: 50,
    };
    expect(() => materialInputSchema.parse({ ...base, sell_price: -1 })).toThrow();
    expect(() => materialInputSchema.parse({ ...base, cost: -1 })).toThrow();
    expect(() => materialInputSchema.parse({ ...base, gst_rate: 101 })).toThrow();
    expect(() => materialInputSchema.parse({ ...base, warranty_months: 121 })).toThrow();
    expect(() => materialInputSchema.parse({ ...base, name: "" })).toThrow();
    expect(() => materialInputSchema.parse({ ...base, sku: "" })).toThrow();
  });
});
