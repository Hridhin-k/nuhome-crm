/** Normalize Indian-style numbers to digits so +91 98765 43210 matches 9876543210. */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isComparablePhone(phone: string | null | undefined) {
  const normalized = normalizePhone(phone);
  return Boolean(normalized && normalized.length >= 10);
}
