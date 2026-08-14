import { AppLink } from "@/components/app/app-link";
import { cn } from "@/lib/utils";

export function StatusFilterNav({
  ariaLabel,
  items,
  active,
  hrefFor,
}: {
  ariaLabel: string;
  items: { id: string; label: string }[];
  active: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-surface-variant bg-surface-container-low p-1"
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <AppLink
            key={item.id}
            href={hrefFor(item.id)}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              selected
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {item.label}
          </AppLink>
        );
      })}
    </nav>
  );
}
