import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppNavbar, MobileBottomNav } from "@/components/app/app-nav";
import { WalkInFab } from "@/components/app/walk-in-fab";
import { PrefetchRoutes } from "@/components/app/prefetch-routes";
import { RouteProgress } from "@/components/app/route-progress";
import { NotificationBellFallback } from "@/components/app/notification-bell";
import { NotificationBellLoader } from "@/components/app/notification-bell-loader";
import { requireUser } from "@/lib/auth/guards";
import { navForRoles, roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const items = navForRoles(user.roles, user.role);
  const canQuote = rolesHavePermission(user.roles, "quotes.create");
  const canAdmin = rolesHavePermission(user.roles, "admin.manage");
  const warm = [
    ...items.map((item) => item.href),
    ...(canQuote ? ["/walk-in"] : []),
    ...(canAdmin ? ["/users", "/vendors", "/materials", "/company", "/reports"] : []),
  ];

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background text-on-background">
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <div className="print:hidden">
        <AppNavbar
          items={items}
          name={user.fullName}
          role={roleLabels(user.roles)}
          bell={
            <Suspense fallback={<NotificationBellFallback />}>
              <NotificationBellLoader userId={user.id} />
            </Suspense>
          }
        />
      </div>

      <main className="min-w-0 flex-1 bg-background px-4 pt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] print:bg-white print:px-0 print:pb-0 md:px-8 md:pt-6 md:pb-10">
        <div className="pt-4 md:pt-0">{children}</div>
      </main>

      <div className="print:hidden">
        <MobileBottomNav items={items} />
        {canQuote ? <WalkInFab /> : null}
      </div>
      <PrefetchRoutes hrefs={warm} />
    </div>
  );
}
