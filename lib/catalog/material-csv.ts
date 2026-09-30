import type { CsvRow } from "@/lib/csv";
import {
  normalizeMaterialSpecs,
  parseSpecColumn,
  type MaterialSpec,
} from "@/lib/catalog/material-specs";
import {
  normalizeMaterialVendors,
  parseVendorColumn,
  type MaterialVendorInput,
} from "@/lib/catalog/material-vendors";

export const MATERIAL_CSV_COLUMNS = [
  "sku",
  "name",
  "category",
  "unit",
  "sell_price",
  "cost",
  "hsn_code",
  "gst_rate",
  "warranty_months",
  "office_quantity",
  "vendors",
  "specs",
  "description",
] as const;

export type SavedMaterial = {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  unit: string;
  default_sell_price: number | string;
  default_cost: number | string;
};

/** Undefined fields are left as they are saved. */
export type MaterialCsvPlan = {
  id?: string;
  sku: string;
  name: string;
  category: { id: string } | { name: string };
  unit: string;
  sellPrice: number;
  cost: number;
  hsnCode?: string;
  gstRate?: number;
  warrantyMonths?: number;
  description?: string;
  specs?: MaterialSpec[];
  officeQuantity?: number;
  vendors?: MaterialVendorInput[];
};

function cell(row: CsvRow, key: string) {
  const value = (row[key] ?? "").trim();
  return value || undefined;
}

function numberCell(
  row: CsvRow,
  key: string,
  label: string,
  limits: { max?: number; whole?: boolean } = {},
) {
  const raw = cell(row, key);
  if (raw === undefined) return undefined;
  const value = Number(raw.replace(/[,₹%\s]/g, ""));
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a number`);
  }
  if (value < 0) {
    throw new Error(`${label} cannot be negative`);
  }
  if (limits.whole && !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number`);
  }
  if (limits.max !== undefined && value > limits.max) {
    throw new Error(`${label} can be at most ${limits.max}`);
  }
  return value;
}

/**
 * One CSV row as a save. A blank cell keeps what is saved on that SKU.
 * A new SKU needs a name, category, and sell price.
 */
export function planMaterialCsvRow(
  row: CsvRow,
  saved?: SavedMaterial,
): MaterialCsvPlan {
  const sku = cell(row, "sku");
  if (!sku) throw new Error("SKU is required");

  const name = cell(row, "name") ?? saved?.name;
  if (!name) throw new Error("Name is required for a new material");

  const categoryName = cell(row, "category");
  const category = categoryName
    ? { name: categoryName }
    : saved?.category_id
      ? { id: saved.category_id }
      : null;
  if (!category) throw new Error("Category is required for a new material");

  const sellPrice =
    numberCell(row, "sell_price", "Sell price") ??
    (saved ? Number(saved.default_sell_price) : undefined);
  if (sellPrice === undefined) {
    throw new Error("Sell price is required for a new material");
  }

  const hsnCode = cell(row, "hsn_code");
  if (hsnCode && hsnCode.length > 8) {
    throw new Error("HSN code can be at most 8 characters");
  }

  const description = cell(row, "description");
  if (description && description.length > 2000) {
    throw new Error("Description can be at most 2000 characters");
  }

  const specsCell = cell(row, "specs");
  const vendorsCell = cell(row, "vendors");

  return {
    id: saved?.id,
    sku,
    name,
    category,
    unit: cell(row, "unit") ?? saved?.unit ?? "pcs",
    sellPrice,
    cost:
      numberCell(row, "cost", "Cost") ??
      (saved ? Number(saved.default_cost) : 0),
    hsnCode,
    gstRate: numberCell(row, "gst_rate", "GST rate", { max: 100 }),
    warrantyMonths: numberCell(row, "warranty_months", "Warranty months", {
      max: 120,
      whole: true,
    }),
    description,
    specs: specsCell
      ? normalizeMaterialSpecs(parseSpecColumn(specsCell))
      : undefined,
    officeQuantity: numberCell(row, "office_quantity", "Quantity at office"),
    vendors: vendorsCell
      ? normalizeMaterialVendors(parseVendorColumn(vendorsCell))
      : undefined,
  };
}
