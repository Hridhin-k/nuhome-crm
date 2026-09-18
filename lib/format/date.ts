const KOLKATA = "Asia/Kolkata";

function asDate(iso: string | Date) {
  return typeof iso === "string" ? new Date(iso) : iso;
}

/** Machine / filter date: `2026-08-16` in Asia/Kolkata. */
export function kolkataDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KOLKATA }).format(value);
}

/** Display date only: `16 Aug 2026`. */
export function formatIstDate(iso: string | Date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(asDate(iso));
}

/** Display datetime: `16 Aug 2026, 2:00 pm`. */
export function formatIstDateTime(iso: string | Date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(asDate(iso));
}

/** Display time only: `2:00 pm`. */
export function formatIstTime(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(asDate(iso));
}

/** Day group label: `Sunday, 17 Aug` (+ year if not current). */
export function formatIstDayLabel(iso: string | Date, now = new Date()) {
  const date = asDate(iso);
  const yearOf = (value: Date) =>
    new Intl.DateTimeFormat("en-IN", {
      timeZone: KOLKATA,
      year: "numeric",
    }).format(value);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA,
    weekday: "long",
    day: "numeric",
    month: "short",
    year: yearOf(date) !== yearOf(now) ? "numeric" : undefined,
  }).format(date);
}

/** Short date without year (lists / relative fallback): `16 Aug`. */
export function formatIstShortDate(iso: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA,
    day: "numeric",
    month: "short",
  }).format(asDate(iso));
}

/** Home hero style: `Friday, 18 Sep • 2:32 pm IST`. */
export function formatIstHomeLabel(iso: string | Date = new Date()) {
  const date = asDate(iso);
  const day = new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
  const time = formatIstTime(date);
  return `${day} • ${time} IST`;
}

export { KOLKATA as IST_TIMEZONE };
