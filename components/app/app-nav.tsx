"use client";

import { AppLink } from "@/components/app/app-link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/app/nav-icon";
import { ChevronLeft } from "lucide-react";
import { navChrome } from "@/lib/auth/nav-chrome";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/auth/nav";
import type { ReactNode } from "react";

export function MobileBottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 h-16 border-t border-outline-variant bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="flex h-full items-stretch justify-around px-1">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <AppLink
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg transition-transform active:scale-95",
                active ? "text-primary" : "text-secondary",
              )}
            >
              <NavIcon
                icon={item.icon}
                className="size-5"
                filled={active && item.icon !== "more"}
              />
              <span
                className={cn(
                  "max-w-full truncate text-label-caps tracking-wide",
                  active && "font-bold",
                )}
              >
                {item.label}
              </span>
            </AppLink>
          );
        })}
      </div>
    </nav>
  );
}

export function AppNavbar({
  items,
  name,
  role,
  bell,
}: {
  items: NavItem[];
  name: string;
  role: string;
  bell: ReactNode;
}) {
  const pathname = usePathname();
  const { title, backHref } = navChrome(pathname);
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const desktopItems = items.filter((item) => item.href !== "/more");

  return (
    <header className="sticky top-0 z-50 bg-[#09090b]">
      <div className="relative mx-auto flex h-12 max-w-6xl items-center px-2 md:h-14 md:gap-6 md:px-8">
        <div className="flex w-16 shrink-0 items-center md:w-auto">
          {backHref ? (
            <AppLink
              href={backHref}
              aria-label="Back"
              className="inline-flex size-10 items-center justify-center rounded-full text-on-primary hover:bg-white/10 md:hidden"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </AppLink>
          ) : (
            <span className="hidden size-10 md:hidden" aria-hidden />
          )}
          <AppLink
            href="/home"
            className="hidden shrink-0 text-[17px] font-bold tracking-tight text-on-primary md:block md:text-headline-md"
          >
            Nuhome
          </AppLink>
        </div>

        <h1 className="pointer-events-none absolute inset-x-16 truncate text-center text-headline-md font-bold tracking-tight text-on-primary md:hidden">
          {title}
        </h1>

        <nav
          aria-label="Primary"
          className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex"
        >
          {desktopItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <AppLink
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/15 text-on-primary"
                    : "text-on-primary/65 hover:bg-white/10 hover:text-on-primary",
                )}
              >
                <NavIcon icon={item.icon} className="size-4" filled={active} />
                <span>{item.label}</span>
              </AppLink>
            );
          })}
        </nav>

        <div className="ml-auto flex w-16 shrink-0 items-center justify-end gap-1 md:w-auto md:gap-2">
          {bell}
          <AppLink
            href="/more"
            className="inline-flex items-center gap-2 rounded-lg py-1 pr-1 pl-1 transition-colors hover:bg-white/10"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-full border border-on-primary/20 bg-white/15 text-[11px] font-semibold text-on-primary">
              {initials || "N"}
            </span>
            <span className="hidden max-w-[140px] truncate text-left md:block">
              <span className="block text-sm font-medium text-on-primary">
                {name}
              </span>
              <span className="block text-xs text-on-primary/60">{role}</span>
            </span>
          </AppLink>
        </div>
      </div>
    </header>
  );
}

/** @deprecated Use AppNavbar */
export function DesktopSidebar(props: Parameters<typeof AppNavbar>[0]) {
  return <AppNavbar {...props} />;
}

/** @deprecated Use AppNavbar */
export function DesktopNavbar(props: Parameters<typeof AppNavbar>[0]) {
  return <AppNavbar {...props} />;
}
