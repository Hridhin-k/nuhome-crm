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
            "rounded-full border px-4 py-1.5 text-subheading whitespace-nowrap transition-colors",
            current === item.href
              ? "border-primary bg-primary text-on-primary"
              : "border-outline-variant bg-card text-on-surface hover:bg-muted",
          )}
        >
          {item.label}
        </AppLink>
      ))}
    </nav>
  );
}
