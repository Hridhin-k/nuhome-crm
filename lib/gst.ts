export const DEFAULT_GST_RATE = 18;

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function clampDiscountPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** The catalog price already includes GST, so nothing is added on top. */
export function lineTaxable(quantity: number, unitPrice: number) {
  return Math.max(0, roundMoney(quantity * unitPrice));
}

export function lineGstAmount(
  _quantity: number,
  _unitPrice: number,
  _gstRate: number,
) {
  return 0;
}

export function lineInclusive(
  quantity: number,
  unitPrice: number,
  _gstRate: number,
) {
  return lineTaxable(quantity, unitPrice);
}

export function lineDiscountAmount(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
  gstRate: number,
) {
  return roundMoney(
    lineInclusive(quantity, unitPrice, gstRate) *
      clampDiscountPercent(discountPercent) /
      100,
  );
}

export function lineTotalWithGst(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
  gstRate: number,
) {
  return roundMoney(
    lineInclusive(quantity, unitPrice, gstRate) -
      lineDiscountAmount(quantity, unitPrice, discountPercent, gstRate),
  );
}

/** Turns a stored pre-tax rupee discount into the percent used by the new rule. */
export function discountPercentFromRupees(
  quantity: number,
  unitPrice: number,
  discountRupees: number,
) {
  const base = quantity * unitPrice;
  if (!(base > 0) || !(discountRupees > 0)) return 0;
  return clampDiscountPercent((discountRupees / base) * 100);
}
