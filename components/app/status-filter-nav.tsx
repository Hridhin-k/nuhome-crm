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
      className="-mx-4 mb-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <AppLink
            key={item.id}
            href={hrefFor(item.id)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-1.5 text-subheading whitespace-nowrap transition-colors",
              selected
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant/80 bg-card text-on-surface shadow-card",
            )}
          >
            {item.label}
          </AppLink>
        );
      })}
    </nav>
  );
}
