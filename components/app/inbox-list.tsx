import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronRight,
  FileText,
  Lock,
  Package,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { AppLink } from "@/components/app/app-link";
import {
  accentFill,
  ProgressBar,
  type Accent,
} from "@/components/app/progress-bar";
import { cn } from "@/lib/utils";

export type InboxItem = {
  title: string;
  count: number;
  href: string;
  detail: string;
  cta?: string;
  alert?: boolean;
  accent?: Accent;
  progress?: { value: number; max: number };
};

function inboxIcon(title: string) {
  const key = title.toLowerCase();
  if (key.includes("customer")) return Users;
  if (key.includes("quote") || key.includes("approval")) return FileText;
  if (key.includes("payment")) return Wallet;
  if (key.includes("overdue")) return AlertTriangle;
  if (key.includes("hold") || key.includes("collect")) return Lock;
  if (key.includes("deliver") || key.includes("ready")) return Truck;
  if (key.includes("vendor") || key.includes("dispatch")) return Truck;
  if (key.includes("item") || key.includes("fulfill") || key.includes("order"))
    return Boxes;
  return Package;
}

function focusCta(item: InboxItem) {
  if (item.cta) return item.cta;
  const title = item.title.toLowerCase();
  if (title.includes("approval")) return "Review quotes";
  if (title.includes("verification") || title.includes("payment"))
    return "Verify payments";
  if (title.includes("overdue")) return "Chase overdue";
  if (title.includes("ready") || title.includes("deliver")) return "Start handover";
  if (title.includes("vendor") || title.includes("dispatch")) return "Open fulfillment";
  if (title.includes("quote")) return "Continue quotes";
  if (title.includes("customer")) return "Open customers";
  if (title.includes("hold") || title.includes("collect")) return "Collect balance";
  return "Open";
}

function isAlertItem(item: InboxItem) {
  return Boolean(item.alert || item.title.toLowerCase().includes("overdue"));
}

export function pickHomeFocus(items: InboxItem[]) {
  const live = items.filter((item) => item.count > 0);
  return (
    live.find((item) => isAlertItem(item)) ??
    live.find((item) => {
      const title = item.title.toLowerCase();
      return (
        title.includes("approval") ||
        title.includes("verification") ||
        title.includes("ready") ||
        title.includes("attention")
      );
    }) ??
    live[0] ??
    null
  );
}

export function InboxList({
  items,
  highlight = false,
}: {
  items: InboxItem[];
  highlight?: boolean;
}) {
  const focus = highlight ? pickHomeFocus(items) : null;
  const rest = focus
    ? items.filter((item) => item.title !== focus.title)
    : items;
  const allClear = items.every((item) => item.count === 0);

  return (
    <div className="flex flex-col gap-3">
      {highlight && allClear ? <ClearDesk /> : null}
      {focus && !allClear ? <FocusCard item={focus} /> : null}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rest.map((item) => (
          <li key={item.title} className="min-w-0">
            <QueueTile item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClearDesk() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-success/20 bg-success-container/60 px-4 py-4">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-on-primary">
        <CheckCircle2 className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-subheading text-on-surface">You’re clear</p>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Nothing is waiting on this desk. New work will land here.
        </p>
      </div>
    </div>
  );
}

function FocusCard({ item }: { item: InboxItem }) {
  const Icon = inboxIcon(item.title);
  const alert = isAlertItem(item);

  return (
    <AppLink
      href={item.href}
      className={cn(
        "flex min-w-0 flex-col justify-between gap-5 rounded-2xl border bg-card p-5 shadow-card md:flex-row md:items-end",
        alert ? "border-error" : "border-primary/20",
      )}
    >
      <div className="min-w-0">
        <p className="text-label-caps text-on-surface-variant">Start here</p>
        <div className="mt-3 flex items-start gap-3">
          <span
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-xl",
              alert
                ? "bg-error-container text-error"
                : "bg-secondary-container text-on-secondary-container",
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-subheading",
                alert ? "text-error" : "text-on-surface",
              )}
            >
              {item.title}
            </p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              {item.detail}
            </p>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-end justify-between gap-6 md:flex-col md:items-end">
        <p
          className={cn(
            "text-display-lg tabular-nums tracking-tight",
            alert ? "text-error" : "text-on-surface",
          )}
        >
          {item.count}
        </p>
        <span className="inline-flex items-center gap-1 text-subheading text-primary">
          {focusCta(item)}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      </div>
    </AppLink>
  );
}

function QueueTile({ item }: { item: InboxItem }) {
  const empty = item.count === 0;
  const Icon = inboxIcon(item.title);
  const alert = isAlertItem(item) && !empty;
  const accent: Accent = item.accent ?? "cerulean";

  return (
    <AppLink
      href={item.href}
      className={cn(
        "flex h-full min-w-0 flex-col rounded-2xl border bg-card p-4 shadow-card",
        alert ? "border-error" : "border-outline-variant",
        empty && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-xl",
            alert
              ? "bg-error-container text-error"
              : empty
                ? "bg-surface-container-high text-on-surface-variant"
                : "bg-surface-container-low text-on-surface",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span
          className={cn(
            "text-headline-md tabular-nums tracking-tight",
            alert ? "text-error" : empty ? "text-outline" : "text-on-surface",
          )}
        >
          {item.count}
        </span>
      </div>
      <p
        className={cn(
          "mt-4 text-subheading",
          alert ? "text-error" : "text-on-surface",
        )}
      >
        {item.title}
      </p>
      <p className="mt-1 min-h-10 flex-1 text-body-sm text-on-surface-variant">
        {item.detail}
      </p>
      {item.progress ? (
        <div className="mt-3">
          <ProgressBar
            value={item.progress.value}
            max={item.progress.max}
            accent={alert ? "cobalt" : accent}
          />
        </div>
      ) : (
        <span
          className={cn("mt-3 h-1.5 w-8 rounded-full", accentFill[accent], empty && "opacity-30")}
        />
      )}
    </AppLink>
  );
}
