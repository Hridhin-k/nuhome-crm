const KOLKATA = "Asia/Kolkata";

export function kolkataDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KOLKATA }).format(value);
}

export function defaultDateRange(now = new Date()) {
  const to = kolkataDate(now);
  const start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: kolkataDate(start), to };
}

export function parseYmd(value: string | undefined | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export function inDateRange(
  iso: string | null | undefined,
  from?: string | null,
  to?: string | null,
) {
  if (!iso) return !from && !to;
  const day = iso.length <= 10 ? iso.slice(0, 10) : kolkataDate(new Date(iso));
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function rangeToIso(from: string, to: string) {
  return {
    start: new Date(`${from}T00:00:00+05:30`).toISOString(),
    end: new Date(`${to}T23:59:59.999+05:30`).toISOString(),
  };
}

export function daysSitting(iso: string, now = new Date()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000)));
}

export function sanitizeSearch(query?: string | null) {
  return (query ?? "").trim().replace(/[%_,()]/g, "").replace(/,/g, " ").trim();
}

export function matchesSearch(
  haystacks: (string | null | undefined)[],
  query?: string | null,
) {
  const q = sanitizeSearch(query).toLowerCase();
  if (!q) return true;
  return haystacks.some((value) => (value ?? "").toLowerCase().includes(q));
}

export function pathWithQuery(
  path: string,
  params: Record<string, string | undefined | null>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export function formatIstDateTime(iso: string | Date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: KOLKATA,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}
