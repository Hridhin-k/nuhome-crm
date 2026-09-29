export type MaterialVendorInput = {
  vendor_id?: string;
  vendor_name?: string;
  unit_cost: number;
  is_preferred?: boolean;
};

/** One preferred supplier. Blank ids are dropped. The same vendor cannot appear twice. */
export function normalizeMaterialVendors(rows: MaterialVendorInput[]) {
  if (rows.length === 0) {
    throw new Error("Add at least one vendor");
  }

  const seen = new Set<string>();
  const normalized = rows.map((row) => {
    const vendorId = row.vendor_id?.trim() ?? "";
    const vendorName = row.vendor_name?.trim() ?? "";
    if (!vendorId && !vendorName) {
      throw new Error("Choose a vendor or type a new vendor name");
    }
    if (!Number.isFinite(row.unit_cost) || row.unit_cost < 0) {
      throw new Error("Vendor price cannot be negative");
    }
    const key = vendorId || vendorName.toLowerCase();
    if (seen.has(key)) {
      throw new Error("Each vendor can only be added once");
    }
    seen.add(key);
    return {
      vendor_id: vendorId || undefined,
      vendor_name: vendorId ? undefined : vendorName,
      unit_cost: row.unit_cost,
      is_preferred: Boolean(row.is_preferred),
    };
  });

  const preferredCount = normalized.filter((row) => row.is_preferred).length;
  if (preferredCount === 0) {
    normalized[0].is_preferred = true;
  } else if (preferredCount > 1) {
    let kept = false;
    for (const row of normalized) {
      if (!row.is_preferred) continue;
      if (!kept) {
        kept = true;
        continue;
      }
      row.is_preferred = false;
    }
  }

  return normalized;
}

/** CSV cell: `Vendor A:450*|Vendor B:520`. A star marks the usual supplier. */
export function parseVendorColumn(value: string): MaterialVendorInput[] {
  const parts = value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Add at least one vendor");
  }

  return parts.map((part) => {
    const preferred = part.endsWith("*");
    const body = (preferred ? part.slice(0, -1) : part).trim();
    const splitAt = body.lastIndexOf(":");
    if (splitAt <= 0) {
      throw new Error("Write each vendor as Name:price, separated by |");
    }
    const vendorName = body.slice(0, splitAt).trim();
    const unitCost = Number(body.slice(splitAt + 1).trim());
    if (!vendorName || !Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error("Write each vendor as Name:price, separated by |");
    }
    return {
      vendor_name: vendorName,
      unit_cost: unitCost,
      is_preferred: preferred,
    };
  });
}
