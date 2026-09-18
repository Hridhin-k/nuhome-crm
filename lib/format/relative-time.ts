import { formatIstShortDate, kolkataDate } from "@/lib/format/date";

export function relativeTime(iso: string, now = new Date()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const delta = now.getTime() - then;
  const mins = Math.max(0, Math.round(delta / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24 && kolkataDate(new Date(iso)) === kolkataDate(now)) {
    return `${hours}h ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatIstShortDate(iso);
}
