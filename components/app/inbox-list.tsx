import {
  AlertTriangle,
  Boxes,
  ChevronRight,
  FileText,
  Lock,
  Package,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type InboxItem = {
  title: string;
  count: number;
  href: string;
  detail: string;
  cta?: string;
  alert?: boolean;
};

function inboxIcon(title: string) {
  const key = title.toLowerCase();
  if (key.includes("customer")) return Users;
  if (key.includes("quote") || key.includes("approval")) return FileText;
  if (key.includes("payment")) return Wallet;
  if (key.includes("overdue")) return AlertTriangle;
  if (key.includes("hold")) return Lock;
  if (key.includes("deliver")) return Truck;
  if (key.includes("vendor") || key.includes("dispatch")) return Truck;
  if (key.includes("item") || key.includes("fulfill") || key.includes("order"))
    return Boxes;
  return Package;
}

export function InboxList({ items }: { items: InboxItem[] }) {
  const stacked = items.some((item) => item.cta);

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-3",
        stacked ? "" : "md:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {items.map((item) => {
        const empty = item.count === 0;
        const Icon = inboxIcon(item.title);
        const alert = item.alert || item.title.toLowerCase().includes("overdue");

        return (
          <li key={item.title} className="min-w-0">
            <AppLink
              href={item.href}
              className={cn(
                "flex h-full min-w-0 flex-col rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-sm",
                alert && !empty ? "border-error" : "border-outline-variant",
                empty && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  {item.cta ? (
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
                      <Icon className="size-5" aria-hidden />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-subheading",
                        alert && !empty ? "text-error" : "text-on-surface",
                      )}
                    >
                      {item.title}
                    </p>
                    <p className="mt-1 text-body-sm text-on-surface-variant">
                      {item.detail}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-1 text-data-tabular",
                    alert && !empty
                      ? "bg-error text-on-error"
                      : empty
                        ? "bg-surface-variant text-on-surface"
                        : item.cta
                          ? "bg-error-container text-on-error-container"
                          : "bg-primary text-on-primary",
                  )}
                >
                  {item.count}
                </span>
              </div>
              {item.cta ? (
                <span
                  className={cn(
                    buttonVariants({ variant: "bordered" }),
                    "mt-4 h-10 w-full",
                  )}
                >
                  {item.cta}
                </span>
              ) : (
                <span
                  className={cn(
                    "mt-4 flex items-center gap-1 text-body-sm",
                    alert && !empty ? "text-error" : "text-secondary",
                  )}
                >
                  {alert && !empty ? "Action required" : "View all"}
                  <ChevronRight className="ml-auto size-4" aria-hidden />
                </span>
              )}
            </AppLink>
          </li>
        );
      })}
    </ul>
  );
}
