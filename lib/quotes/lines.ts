import { formatSpecsInline } from "@/lib/catalog/material-specs";
import {
  clampDiscountPercent,
  DEFAULT_GST_RATE,
  discountPercentFromRupees,
  lineDiscountAmount,
  lineGstAmount,
} from "@/lib/gst";

export type SupplySource = "office" | "vendor";

export type QuoteLine = {
  key: string;
  material_id?: string;
  description: string;
  specification?: string;
  item_code?: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  /** Entered percent. 10 means 10% of the tax-inclusive line. */
  discount_percent: number;
  /** Rupee amount taken off the tax-inclusive line. */
  discount: number;
  tax: number;
  hsn_code?: string;
  gst_rate: number;
  supply_source?: SupplySource;
};

export function clampGstRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function withGst(line: QuoteLine): QuoteLine {
  const gst_rate = clampGstRate(line.gst_rate);
  const discount_percent = clampDiscountPercent(Number(line.discount_percent));
  return {
    ...line,
    gst_rate,
    discount_percent,
    tax: lineGstAmount(line.quantity, line.unit_price, gst_rate),
    discount: lineDiscountAmount(
      line.quantity,
      line.unit_price,
      discount_percent,
      gst_rate,
    ),
  };
}

export function lineDescription(
  name: string,
  detail?: string | null,
) {
  const extra = detail?.trim();
  return extra ? `${name} — ${extra}` : name;
}

export function lineFromMaterial(material: {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  specs?: unknown;
  default_sell_price: number | string;
  default_cost: number | string;
  hsn_code?: string | null;
  gst_rate?: number | string | null;
  office_available?: number | null;
}): QuoteLine {
  const shelf = Number(material.office_available ?? 0);
  return withGst({
    key: crypto.randomUUID(),
    material_id: material.id,
    description: material.name,
    specification:
      formatSpecsInline(material.specs) || material.description?.trim() || undefined,
    item_code: material.sku ?? undefined,
    quantity: 1,
    unit_price: Number(material.default_sell_price),
    unit_cost: Number(material.default_cost),
    discount_percent: 0,
    discount: 0,
    tax: 0,
    hsn_code: material.hsn_code ?? undefined,
    gst_rate: Number(material.gst_rate ?? DEFAULT_GST_RATE),
    supply_source: shelf >= 1 ? "office" : "vendor",
  });
}

export function addMaterialLine(
  lines: QuoteLine[],
  material: Parameters<typeof lineFromMaterial>[0],
): QuoteLine[] {
  const existing = lines.find((line) => line.material_id === material.id);
  if (!existing) {
    return [...lines, lineFromMaterial(material)];
  }
  return lines.map((line) =>
    line.key === existing.key
      ? withGst({ ...line, quantity: line.quantity + 1 })
      : line,
  );
}

export function addMaterialLines(
  lines: QuoteLine[],
  materials: Parameters<typeof lineFromMaterial>[0][],
): QuoteLine[] {
  return materials.reduce(
    (current, material) => addMaterialLine(current, material),
    lines,
  );
}

export function linesFromQuoteItems(
  items: {
    id?: string;
    material_id: string | null;
    description: string;
    quantity: number | string;
    unit_price: number | string;
    unit_cost: number | string;
    discount: number | string;
    discount_percent?: number | string | null;
    tax: number | string;
    hsn_code?: string | null;
    gst_rate?: number | string | null;
    specification?: string | null;
    item_code?: string | null;
    supply_source?: SupplySource | null;
  }[],
): QuoteLine[] {
  return items.map((item, index) => {
    const quantity = Math.max(1, Math.round(Number(item.quantity)));
    const unit_price = Number(item.unit_price);
    const storedPercent = item.discount_percent;
    const discount_percent =
      storedPercent != null && storedPercent !== ""
        ? Number(storedPercent)
        : discountPercentFromRupees(quantity, unit_price, Number(item.discount));
    return withGst({
      key: item.id ?? `line-${index}`,
      material_id: item.material_id ?? undefined,
      description: item.description,
      specification: item.specification ?? undefined,
      item_code: item.item_code ?? undefined,
      quantity,
      unit_price,
      unit_cost: Number(item.unit_cost),
      discount_percent,
      discount: 0,
      tax: Number(item.tax),
      hsn_code: item.hsn_code ?? undefined,
      gst_rate: Number(item.gst_rate ?? 0),
      supply_source: item.supply_source === "office" ? "office" : "vendor",
    });
  });
}
