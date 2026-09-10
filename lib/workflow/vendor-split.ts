export type VendorSplitLine = {
  order_item_id: string;
  vendor_id: string;
  quantity: number;
  unit_cost?: number;
};

export function groupLinesByVendor(lines: VendorSplitLine[]) {
  const groups = new Map<string, VendorSplitLine[]>();
  for (const line of lines) {
    if (!line.vendor_id || line.quantity <= 0) continue;
    const current = groups.get(line.vendor_id) ?? [];
    current.push(line);
    groups.set(line.vendor_id, current);
  }
  return [...groups.entries()].map(([vendor_id, items]) => ({
    vendor_id,
    items: items.map((item) => ({
      order_item_id: item.order_item_id,
      quantity: item.quantity,
    })),
    quote_amount: suggestedVendorQuoteAmount(items),
  }));
}

export function suggestedVendorQuoteAmount(lines: { quantity: number; unit_cost?: number }[]) {
  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.unit_cost ?? 0),
    0,
  );
  return Math.round(total * 100) / 100;
}

export function suggestedVendorQuoteRef(orderNumber: string, vendorName: string) {
  const slug = vendorName
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12)
    .toUpperCase();
  return `${orderNumber}-${slug || "VENDOR"}`;
}
