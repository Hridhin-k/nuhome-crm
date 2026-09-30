export function invoiceSupplyNote(item: {
  supply_source?: string | null;
  quantity: number | string;
  quantity_handed_over?: number | string | null;
}) {
  if (
    item.supply_source === "office" &&
    Number(item.quantity_handed_over ?? 0) >= Number(item.quantity)
  ) {
    return "Supplied today";
  }
  if (item.supply_source === "vendor") return "To be delivered";
  if (item.supply_source === "office") return "From office";
  return undefined;
}
