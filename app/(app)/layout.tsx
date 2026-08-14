import type { ReactNode } from "react";
import { AppNavbar, MobileBottomNav } from "@/components/app/app-nav";
import { WalkInFab } from "@/components/app/walk-in-fab";
import { PrefetchRoutes } from "@/components/app/prefetch-routes";
import { listNotifications } from "@/lib/api/notifications";
import { requireUser } from "@/lib/auth/guards";
import { navForRole, roleLabel } from "@/lib/auth/nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const items = navForRole(user.role);
  const notifications = await listNotifications(user.id).catch(() => []);
  const warm = [
    ...items.map((item) => item.href),
    ...(user.role === "sales" || user.role === "admin"
      ? ["/walk-in", "/customers/new"]
      : []),
    ...(user.role === "admin" ? ["/users", "/vendors", "/materials"] : []),
  ];

  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-clip bg-background text-on-background">
      <AppNavbar
        items={items}
        name={user.fullName}
        role={roleLabel(user.role)}
        userId={user.id}
        notifications={notifications}
      />

      <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto bg-background px-4 pt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:px-8 md:pt-6 md:pb-10">
        <div className="pt-4 md:pt-0">{children}</div>
      </main>

      <MobileBottomNav items={items} />
      {user.role === "sales" || user.role === "admin" ? <WalkInFab /> : null}
      <PrefetchRoutes hrefs={warm} />
    </div>
  );
}
