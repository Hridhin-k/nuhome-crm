/** Indian mobiles are 10 digits after dropping +91 / leading 0. */
export const LOCAL_MOBILE_DIGITS = 10;

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
  return Boolean(normalized && normalized.length >= LOCAL_MOBILE_DIGITS);
}

/** Strip letters/formatting and cap at 10 local digits (country code not counted). */
export function sanitizeLocalMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, LOCAL_MOBILE_DIGITS);
}

export function isLocalMobile(phone: string | null | undefined): boolean {
  if (phone == null || phone.trim() === "") return true;
  if (/[A-Za-z]/.test(phone)) return false;
  const digits = normalizePhone(phone);
  return Boolean(digits && digits.length === LOCAL_MOBILE_DIGITS);
}
