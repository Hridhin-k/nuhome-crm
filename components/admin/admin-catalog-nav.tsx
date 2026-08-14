import { AppLink } from "@/components/app/app-link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/users", label: "Users" },
  { href: "/vendors", label: "Vendors" },
  { href: "/materials", label: "Materials" },
] as const;

export function AdminCatalogNav({
  current,
}: {
  current: (typeof ITEMS)[number]["href"];
}) {
  return (
    <nav
      aria-label="Catalog"
      className="mb-6 flex gap-2 overflow-x-auto pb-1"
    >
      {ITEMS.map((item) => (
        <AppLink
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            current === item.href
              ? "border-primary bg-primary text-on-primary"
              : "border-surface-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container",
          )}
        >
          {item.label}
        </AppLink>
      ))}
    </nav>
  );
}
