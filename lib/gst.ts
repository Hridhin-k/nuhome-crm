export const DEFAULT_GST_RATE = 18;

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function lineTaxable(
  quantity: number,
  unitPrice: number,
  discount: number,
) {
  return Math.max(0, roundMoney(quantity * unitPrice - discount));
}

export function lineGstAmount(
  quantity: number,
  unitPrice: number,
  discount: number,
  gstRate: number,
) {
  return roundMoney(lineTaxable(quantity, unitPrice, discount) * (gstRate || 0) / 100);
}

export function lineTotalWithGst(
  quantity: number,
  unitPrice: number,
  discount: number,
  gstRate: number,
) {
  const taxable = lineTaxable(quantity, unitPrice, discount);
  return roundMoney(taxable + lineGstAmount(quantity, unitPrice, discount, gstRate));
}
