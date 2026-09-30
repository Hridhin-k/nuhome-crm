import { describe, expect, it } from "vitest";
import { normalizeCsvHeader, parseCsv, readCsvTable, toCsv } from "@/lib/csv";

describe("readCsvTable", () => {
  const columns = { required: ["sku"], allowed: ["sku", "name", "sell_price"] };

  it("returns rows with their spreadsheet row numbers", () => {
    const table = readCsvTable('sku,name\nMK-1,Cabinet\n\nMK-2,"Two\nlines"\nMK-3,Three\n', columns);
    expect(table.rows.map((row) => row.sku)).toEqual(["MK-1", "MK-2", "MK-3"]);
    expect(table.lines).toEqual([2, 4, 6]);
  });

  it("allows empty trailing cells from spreadsheets", () => {
    expect(readCsvTable("sku,name,,\nMK-1,Cabinet,,\n", columns).rows).toHaveLength(1);
  });

  it("names the row with an unquoted comma", () => {
    expect(() =>
      readCsvTable("sku,name,sell_price\nMK-1,Cabinet,7400\nMK-2,Hinge,7,400\n", columns),
    ).toThrow("Row 3 has 4 values, but there are 3 columns. A value with a comma");
  });

  it("names the row that is short a value", () => {
    expect(() => readCsvTable("sku,name,sell_price\nMK-1,7400\n", columns)).toThrow(
      "Row 2 has 2 values, but there are 3 columns. A comma may be missing",
    );
  });

  it("names the row with a quote that never closes", () => {
    expect(() => readCsvTable('sku,name\nMK-1,Cabinet\nMK-2,"Hinge\nMK-3,Three\n', columns)).toThrow(
      'Row 3: a quote mark (") is opened but never closed',
    );
  });

  it("rejects missing, repeated, and unknown columns", () => {
    expect(() => readCsvTable("name\nCabinet\n", columns)).toThrow(
      "Row 1 must be the column names, and sku is missing",
    );
    expect(() => readCsvTable("sku,name,SKU\nA,B,C\n", columns)).toThrow(
      "Column sku appears twice, in columns A and C",
    );
    expect(() => readCsvTable("sku,venders\nA,B\n", columns)).toThrow(
      "Column B (“venders”) is not a column this import reads",
    );
  });

  it("recognises an Excel file and an empty file", () => {
    expect(() => readCsvTable("PK\u0003\u0004binary", columns)).toThrow("This is an Excel file");
    expect(() => readCsvTable("  \n", columns)).toThrow("The file is empty");
  });
});

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
