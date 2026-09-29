type Movement = {
  material_id: string;
  kind: string;
  quantity: number | string;
};

export type OfficeBalance = {
  onHand: number;
  reserved: number;
};

function add(map: Map<string, OfficeBalance>, materialId: string) {
  const current = map.get(materialId);
  if (current) return current;
  const created = { onHand: 0, reserved: 0 };
  map.set(materialId, created);
  return created;
}

/** On-hand and reserved from the movement ledger. */
export function officeBalances(movements: Movement[]) {
  const map = new Map<string, OfficeBalance>();
  for (const movement of movements) {
    const quantity = Number(movement.quantity);
    if (!Number.isFinite(quantity)) continue;
    const balance = add(map, movement.material_id);
    if (
      movement.kind === "receipt" ||
      movement.kind === "adjustment" ||
      movement.kind === "void"
    ) {
      balance.onHand += quantity;
    } else if (movement.kind === "handover") {
      balance.onHand -= quantity;
      balance.reserved -= quantity;
    } else if (movement.kind === "reservation") {
      balance.reserved += quantity;
    } else if (movement.kind === "release") {
      balance.reserved -= quantity;
    }
  }
  return map;
}

export function quantityDelta(current: number, next: number) {
  const delta = next - current;
  return Math.abs(delta) < 1e-6 ? 0 : delta;
}
