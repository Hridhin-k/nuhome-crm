import {
  lineFromMaterial,
  withGst,
  type QuoteLine,
  type SupplySource,
} from "@/lib/quotes/lines";

export function addCatalogueMaterial(
  lines: QuoteLine[],
  material: Parameters<typeof lineFromMaterial>[0],
  shelfByMaterial: Map<string, number>,
): QuoteLine[] {
  const shelf =
    shelfByMaterial.get(material.id) ?? Number(material.office_available ?? 0);
  const left = officeShelf(lines, material.id, shelf);
  const officeLine = lines.find(
    (line) => line.material_id === material.id && line.supply_source === "office",
  );
  const vendorLine = lines.find(
    (line) => line.material_id === material.id && line.supply_source !== "office",
  );

  if (officeLine && left > 0) {
    return setLineQuantity(
      lines,
      officeLine.key,
      officeLine.quantity + 1,
      shelfByMaterial,
    );
  }
  if (vendorLine) {
    return setLineQuantity(
      lines,
      vendorLine.key,
      vendorLine.quantity + 1,
      shelfByMaterial,
    );
  }
  if (officeLine) {
    return [
      ...lines,
      lineFromMaterial({ ...material, office_available: 0 }),
    ];
  }
  return [
    ...lines,
    lineFromMaterial({ ...material, office_available: left }),
  ];
}

export function officeShelf(
  lines: QuoteLine[],
  materialId: string,
  shelf: number,
  exceptKey?: string,
) {
  const taken = lines
    .filter(
      (line) =>
        line.material_id === materialId &&
        line.supply_source === "office" &&
        line.key !== exceptKey,
    )
    .reduce((sum, line) => sum + line.quantity, 0);
  return Math.max(0, shelf - taken);
}

export function setLineSupply(
  lines: QuoteLine[],
  key: string,
  source: SupplySource,
  shelfByMaterial: Map<string, number>,
  nextKey: () => string = () => crypto.randomUUID(),
): QuoteLine[] {
  const line = lines.find((row) => row.key === key);
  if (!line) return lines;
  if (!line.material_id || source === "vendor") {
    return lines.map((row) =>
      row.key === key ? withGst({ ...row, supply_source: "vendor" }) : row,
    );
  }
  const left = officeShelf(
    lines,
    line.material_id,
    shelfByMaterial.get(line.material_id) ?? 0,
    key,
  );
  if (left <= 0) {
    return lines.map((row) =>
      row.key === key ? withGst({ ...row, supply_source: "vendor" }) : row,
    );
  }
  if (line.quantity <= left) {
    return lines.map((row) =>
      row.key === key ? withGst({ ...row, supply_source: "office" }) : row,
    );
  }
  const office = withGst({
    ...line,
    quantity: left,
    supply_source: "office",
  });
  const vendor = withGst({
    ...line,
    key: nextKey(),
    quantity: line.quantity - left,
    supply_source: "vendor",
  });
  return lines.flatMap((row) => (row.key === key ? [office, vendor] : [row]));
}

export function setLineQuantity(
  lines: QuoteLine[],
  key: string,
  quantity: number,
  shelfByMaterial: Map<string, number>,
  nextKey: () => string = () => crypto.randomUUID(),
): QuoteLine[] {
  const line = lines.find((row) => row.key === key);
  if (!line) return lines;
  const qty = Math.max(1, Math.round(quantity));
  if (line.supply_source !== "office" || !line.material_id) {
    return lines.map((row) =>
      row.key === key
        ? withGst({ ...row, quantity: qty, supply_source: "vendor" })
        : row,
    );
  }
  const left = officeShelf(
    lines,
    line.material_id,
    shelfByMaterial.get(line.material_id) ?? 0,
    key,
  );
  if (qty <= left) {
    return lines.map((row) =>
      row.key === key ? withGst({ ...row, quantity: qty }) : row,
    );
  }
  if (left <= 0) {
    return lines.map((row) =>
      row.key === key
        ? withGst({ ...row, quantity: qty, supply_source: "vendor" })
        : row,
    );
  }
  const overflow = qty - left;
  const office = withGst({
    ...line,
    quantity: left,
    supply_source: "office",
  });
  const vendorLine = lines.find(
    (row) =>
      row.key !== key &&
      row.material_id === line.material_id &&
      row.supply_source !== "office",
  );
  if (vendorLine) {
    return lines.flatMap((row) => {
      if (row.key === key) return [office];
      if (row.key === vendorLine.key) {
        return [
          withGst({
            ...row,
            quantity: row.quantity + overflow,
            supply_source: "vendor",
          }),
        ];
      }
      return [row];
    });
  }
  const vendor = withGst({
    ...line,
    key: nextKey(),
    quantity: overflow,
    supply_source: "vendor",
  });
  return lines.flatMap((row) => (row.key === key ? [office, vendor] : [row]));
}
