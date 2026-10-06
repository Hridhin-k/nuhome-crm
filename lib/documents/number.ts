export const DOCUMENT_MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

const MONTH = DOCUMENT_MONTHS.join("|");
const DOCUMENT_NUMBER = new RegExp(`^(QT|OR)\\d{4,}NU(?:${MONTH})\\d{2}$`, "i");
const LEGACY_ORDER_NUMBER = /^ORD-\d+$/i;

export function formatDocumentNumber(
  prefix: "QT" | "OR",
  sequence: number,
  at: Date,
) {
  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new Error("Document sequence starts at 0");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(at);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const body = sequence < 10000 ? String(sequence).padStart(4, "0") : String(sequence);
  return `${prefix}${body}NU${DOCUMENT_MONTHS[month - 1]}${year}`;
}

export function isDocumentNumber(value: string) {
  return DOCUMENT_NUMBER.test(value.trim());
}

export function isOrderNumber(value: string) {
  const trimmed = value.trim();
  if (LEGACY_ORDER_NUMBER.test(trimmed)) return true;
  const match = trimmed.match(DOCUMENT_NUMBER);
  return match?.[1]?.toUpperCase() === "OR";
}
