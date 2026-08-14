"use client";

import { AppLink } from "@/components/app/app-link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/app/nav-icon";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/auth/nav";

export function MobileBottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-outline-variant bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <AppLink
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center rounded-full px-4 py-1 transition-colors",
              active
                ? "bg-secondary-container text-primary"
                : "text-on-surface-variant hover:text-primary",
            )}
          >
            <NavIcon icon={item.icon} className="size-6" />
            <span className="text-label-md mt-1">{item.label}</span>
          </AppLink>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar({
  items,
  name,
  role,
}: {
  items: NavItem[];
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <aside className="relative z-40 hidden h-dvh w-[280px] shrink-0 flex-col border-r border-outline-variant bg-surface py-6 shadow-sm md:flex">
      <div className="mb-6 px-4">
        <AppLink href="/more" className="flex items-center gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-[14px] font-bold text-on-primary">
            {initials || "N"}
          </span>
          <span className="min-w-0">
            <span className="text-label-md block truncate text-on-surface">
              {name}
            </span>
            <span className="text-body-md block text-on-surface-variant">
              {role}
            </span>
          </span>
        </AppLink>
        <p className="text-label-md mt-2 text-outline">Role: {role}</p>
      </div>

      <nav aria-label="Primary" className="flex flex-1 flex-col gap-2 px-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <AppLink
              key={item.href}
              href={item.href}
              className={cn(
                "mr-2 flex items-center gap-4 rounded-r-full px-4 py-3 transition-all duration-200",
                active
                  ? "bg-primary-container font-semibold text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container-highest",
              )}
            >
              <NavIcon icon={item.icon} className="size-5" />
              <span className="text-label-md">{item.label}</span>
            </AppLink>
          );
        })}
      </nav>

      <div className="mt-auto px-4 pt-4">
        <p className="text-[13px] font-bold text-on-surface">Nuhome</p>
        <p className="text-body-md text-on-surface-variant">
          Enterprise Manager
        </p>
      </div>
    </aside>
  );
}

export function DesktopTopBar({ title }: { title?: string }) {
  return (
    <header className="hidden h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-12 md:flex">
      <h1 className="text-headline-md text-on-surface">{title ?? "Overview"}</h1>
      <div className="flex items-center gap-4 text-on-surface-variant">
        <span className="text-body-md">Nuhome</span>
      </div>
    </header>
  );
}

/** @deprecated */
export function DesktopNavbar(props: {
  items: NavItem[];
  name: string;
  role: string;
}) {
  return <DesktopSidebar {...props} />;
}
