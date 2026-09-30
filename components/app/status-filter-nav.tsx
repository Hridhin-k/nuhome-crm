import { AppLink } from "@/components/app/app-link";
import { chipVariants } from "@/components/ui/chip";

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
            aria-current={selected ? "page" : undefined}
            className={chipVariants({ selected })}
          >
            {item.label}
          </AppLink>
        );
      })}
    </nav>
  );
}
