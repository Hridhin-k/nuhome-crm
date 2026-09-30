import { describe, expect, it } from "vitest";
import { planMaterialCsvRow, type SavedMaterial } from "@/lib/catalog/material-csv";
import { parseCsv } from "@/lib/csv";

const saved: SavedMaterial = {
  id: "11111111-1111-1111-1111-111111111111",
  sku: "AP-CHIMNEY-60",
  name: "Chimney 60cm",
  category_id: "22222222-2222-2222-2222-222222222222",
  unit: "pcs",
  default_sell_price: "9800",
  default_cost: 6100,
};

function row(csv: string) {
  return parseCsv(csv).rows[0];
}

describe("planMaterialCsvRow", () => {
  it("reads a full new row", () => {
    const plan = planMaterialCsvRow(
      row(
        "sku,name,category,unit,sell_price,cost,hsn_code,gst_rate,warranty_months,office_quantity,vendors,specs,description\n" +
          'MK-1,Wall cabinet,Modular Kitchen,pcs,"7,400",4600,9403,18%,12,2,Adhams:4600*|Kerala Woods:4800,Colour: White|Dimensions: 900 mm,Lift-up door\n',
      ),
    );
    expect(plan).toMatchObject({
      id: undefined,
      sku: "MK-1",
      name: "Wall cabinet",
      category: { name: "Modular Kitchen" },
      sellPrice: 7400,
      cost: 4600,
      hsnCode: "9403",
      gstRate: 18,
      warrantyMonths: 12,
      officeQuantity: 2,
      description: "Lift-up door",
      specs: [
        { label: "Colour", value: "White" },
        { label: "Dimensions", value: "900 mm" },
      ],
    });
    expect(plan.vendors).toEqual([
      { vendor_id: undefined, vendor_name: "Adhams", unit_cost: 4600, is_preferred: true },
      { vendor_id: undefined, vendor_name: "Kerala Woods", unit_cost: 4800, is_preferred: false },
    ]);
  });

  it("keeps saved values when cells are blank", () => {
    const plan = planMaterialCsvRow(
      row(
        "sku,name,category,sell_price,cost,office_quantity,vendors,specs,description,gst_rate\nAP-CHIMNEY-60,,,,,,,,,\n",
      ),
      saved,
    );
    expect(plan).toMatchObject({
      id: saved.id,
      name: "Chimney 60cm",
      category: { id: saved.category_id },
      sellPrice: 9800,
      cost: 6100,
    });
    expect(plan.officeQuantity).toBeUndefined();
    expect(plan.vendors).toBeUndefined();
    expect(plan.specs).toBeUndefined();
    expect(plan.description).toBeUndefined();
    expect(plan.gstRate).toBeUndefined();
  });

  it("updates only the office quantity on a saved SKU", () => {
    const plan = planMaterialCsvRow(row("sku,office_quantity\nAP-CHIMNEY-60,0\n"), saved);
    expect(plan.officeQuantity).toBe(0);
    expect(plan.sellPrice).toBe(9800);
  });

  it("needs name, category, and sell price for a new SKU", () => {
    expect(() => planMaterialCsvRow(row("sku,category,sell_price\nNEW-1,Hardware,100\n"))).toThrow(
      /Name is required/,
    );
    expect(() => planMaterialCsvRow(row("sku,name,sell_price\nNEW-1,Hinge,100\n"))).toThrow(
      /Category is required/,
    );
    expect(() => planMaterialCsvRow(row("sku,name,category\nNEW-1,Hinge,Hardware\n"))).toThrow(
      /Sell price is required/,
    );
  });

  it("explains bad numbers and cells", () => {
    expect(() => planMaterialCsvRow(row("sku,office_quantity\nAP-CHIMNEY-60,ten\n"), saved)).toThrow(
      "Quantity at office must be a number",
    );
    expect(() => planMaterialCsvRow(row("sku,cost\nAP-CHIMNEY-60,-5\n"), saved)).toThrow(
      "Cost cannot be negative",
    );
    expect(() => planMaterialCsvRow(row("sku,vendors\nAP-CHIMNEY-60,Adhams 500\n"), saved)).toThrow(
      /Name:price/,
    );
    expect(() => planMaterialCsvRow(row("sku,specs\nAP-CHIMNEY-60,White\n"), saved)).toThrow(
      /Label: value/,
    );
  });
});

describe("material CSV headers", () => {
  it("accepts friendly column names", () => {
    const { headers } = parseCsv(
      "SKU,Quantity at office,Vendor,Specifications,Sell price (₹),Cost price\n",
    );
    expect(headers).toEqual(["sku", "office_quantity", "vendors", "specs", "sell_price", "cost"]);
  });
});
