import { describe, expect, it } from "vitest";
import { normalizeCsvHeader, parseCsv, toCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("reads headers and rows", () => {
    const { rows } = parseCsv("email,full_name,role\nsales@nuhome.demo,Sales Demo,sales\n");
    expect(rows).toEqual([
      { email: "sales@nuhome.demo", full_name: "Sales Demo", role: "sales" },
    ]);
  });

  it("aliases common headers and quoted commas", () => {
    const { rows } = parseCsv('Name,Mobile,Price\n"Vendor, Co",9876543210,"1,200"\n');
    expect(rows[0]).toEqual({
      name: "Vendor, Co",
      phone: "9876543210",
      sell_price: "1,200",
    });
  });

  it("skips blank lines and a BOM", () => {
    const { rows } = parseCsv("\uFEFFsku,name\n\nMK-1,Cabinet\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("MK-1");
  });
});

describe("normalizeCsvHeader", () => {
  it("maps delivery-style labels", () => {
    expect(normalizeCsvHeader("Full Name")).toBe("full_name");
    expect(normalizeCsvHeader("selling price")).toBe("sell_price");
    expect(normalizeCsvHeader("HSN")).toBe("hsn_code");
    expect(normalizeCsvHeader("gst %")).toBe("gst_rate");
  });
});

describe("toCsv", () => {
  it("quotes commas", () => {
    expect(toCsv(["name"], [["A, B"]])).toBe('name\n"A, B"');
  });
});
