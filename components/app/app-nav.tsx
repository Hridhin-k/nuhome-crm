"use client";

import { AppLink } from "@/components/app/app-link";
import { NotificationBell } from "@/components/app/notification-bell";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/app/nav-icon";
import type { AppNotification } from "@/lib/notifications/types";
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

export function AppNavbar({
  items,
  name,
  role,
  userId,
  notifications,
}: {
  items: NavItem[];
  name: string;
  role: string;
  userId: string;
  notifications: AppNotification[];
}) {
  const pathname = usePathname();
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const desktopItems = items.filter((item) => item.href !== "/more");

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:h-16 md:gap-6 md:px-6">
        <AppLink
          href="/home"
          className="shrink-0 text-[15px] font-bold text-primary md:text-base"
        >
          Nuhome
        </AppLink>

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
                  "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary-container text-on-primary-container"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                )}
              >
                <NavIcon icon={item.icon} className="size-4" />
                <span>{item.label}</span>
              </AppLink>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <NotificationBell userId={userId} initial={notifications} />
          <AppLink
            href="/more"
            className="hidden items-center gap-2 rounded-full py-1.5 pr-1 pl-2 transition-colors hover:bg-surface-container md:inline-flex"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary">
              {initials || "N"}
            </span>
            <span className="max-w-[140px] truncate text-left">
              <span className="block text-sm font-medium text-on-surface">
                {name}
              </span>
              <span className="block text-xs text-on-surface-variant">
                {role}
              </span>
            </span>
          </AppLink>
          <span className="text-label-md text-on-surface-variant md:hidden">
            {role}
          </span>
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
