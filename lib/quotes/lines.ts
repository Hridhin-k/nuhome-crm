import { DEFAULT_GST_RATE, lineGstAmount } from "@/lib/gst";

export type QuoteLine = {
  key: string;
  material_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount: number;
  tax: number;
  hsn_code?: string;
  gst_rate: number;
};

export function clampGstRate(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function withGst(line: QuoteLine): QuoteLine {
  const gst_rate = clampGstRate(line.gst_rate);
  return {
    ...line,
    gst_rate,
    tax: lineGstAmount(
      line.quantity,
      line.unit_price,
      line.discount,
      gst_rate,
    ),
  };
}

export function lineFromMaterial(material: {
  id: string;
  name: string;
  default_sell_price: number | string;
  default_cost: number | string;
  hsn_code?: string | null;
  gst_rate?: number | string | null;
}): QuoteLine {
  return withGst({
    key: crypto.randomUUID(),
    material_id: material.id,
    description: material.name,
    quantity: 1,
    unit_price: Number(material.default_sell_price),
    unit_cost: Number(material.default_cost),
    discount: 0,
    tax: 0,
    hsn_code: material.hsn_code ?? undefined,
    gst_rate: Number(material.gst_rate ?? DEFAULT_GST_RATE),
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
    tax: number | string;
    hsn_code?: string | null;
    gst_rate?: number | string | null;
  }[],
): QuoteLine[] {
  return items.map((item, index) =>
    withGst({
      key: item.id ?? `line-${index}`,
      material_id: item.material_id ?? undefined,
      description: item.description,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
      unit_cost: Number(item.unit_cost),
      discount: Number(item.discount),
      tax: Number(item.tax),
      hsn_code: item.hsn_code ?? undefined,
      gst_rate: Number(item.gst_rate ?? 0),
    }),
  );
}
