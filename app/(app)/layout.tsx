import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppNavbar, MobileBottomNav } from "@/components/app/app-nav";
import { WalkInFab } from "@/components/app/walk-in-fab";
import { PrefetchRoutes } from "@/components/app/prefetch-routes";
import { RouteProgress } from "@/components/app/route-progress";
import { NotificationBellFallback } from "@/components/app/notification-bell";
import { NotificationBellLoader } from "@/components/app/notification-bell-loader";
import { LiveRefresh } from "@/components/app/live-refresh";
import { requireUser } from "@/lib/auth/guards";
import { getAccessToken } from "@/lib/auth/session";
import { navForRoles, roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [user, accessToken] = await Promise.all([
    requireUser(),
    getAccessToken(),
  ]);
  const items = navForRoles(user.roles, user.role);
  const canQuote = rolesHavePermission(user.roles, "quotes.create");
  const warm = items.map((item) => item.href);

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-background text-on-background">
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <div className="fixed top-0 inset-x-0 z-50 print:hidden">
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

      <main className="min-w-0 flex-1 bg-background px-4 pt-12 pb-[calc(5.75rem+env(safe-area-inset-bottom))] print:bg-white print:px-0 print:pb-0 md:px-8 md:pt-18 md:pb-10">
        <div className="pt-3 md:pt-0">{children}</div>
      </main>

      <div className="print:hidden">
        <MobileBottomNav items={items} />
        {canQuote ? <WalkInFab /> : null}
      </div>
      <PrefetchRoutes hrefs={warm} />
      <LiveRefresh userId={user.id} accessToken={accessToken} />
    </div>
  );
}
