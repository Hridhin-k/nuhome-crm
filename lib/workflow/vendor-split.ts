export type VendorSplitLine = {
  order_item_id: string;
  vendor_id: string;
  quantity: number;
  unit_cost?: number;
};

export function groupLinesByVendor(lines: VendorSplitLine[]) {
  const groups = new Map<string, Map<string, VendorSplitLine>>();
  for (const line of lines) {
    if (!line.vendor_id || line.quantity <= 0) continue;
    const byItem = groups.get(line.vendor_id) ?? new Map();
    const existing = byItem.get(line.order_item_id);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      byItem.set(line.order_item_id, { ...line });
    }
    groups.set(line.vendor_id, byItem);
  }
  return [...groups.entries()].map(([vendor_id, items]) => {
    const list = [...items.values()];
    return {
      vendor_id,
      items: list.map((item) => ({
        order_item_id: item.order_item_id,
        quantity: item.quantity,
      })),
      quote_amount: suggestedVendorQuoteAmount(list),
    };
  });
}

export function remainingToAllocate(
  available: number,
  rows: { quantity: number }[],
) {
  return Math.max(
    0,
    Math.floor(available) - rows.reduce((sum, row) => sum + Math.trunc(row.quantity), 0),
  );
}

export function nextUnusedVendorId(
  usedVendorIds: string[],
  vendors: { id: string }[],
) {
  return vendors.find((vendor) => !usedVendorIds.includes(vendor.id))?.id ?? vendors[0]?.id;
}

/** Add another vendor row for the same item: leftover qty, or split the last row in half. */
export function nextSplitRow(input: {
  available: number;
  rows: { quantity: number; vendor_id: string }[];
  vendors: { id: string }[];
}): { quantity: number; vendor_id: string } | null {
  if (input.vendors.length === 0) return null;
  const leftover = remainingToAllocate(input.available, input.rows);
  const vendorId = nextUnusedVendorId(
    input.rows.map((row) => row.vendor_id),
    input.vendors,
  );
  if (!vendorId) return null;
  if (leftover > 0) {
    return { quantity: leftover, vendor_id: vendorId };
  }
  const last = input.rows[input.rows.length - 1];
  if (!last || last.quantity < 2) return null;
  const take = Math.floor(last.quantity / 2);
  return { quantity: take, vendor_id: vendorId };
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
