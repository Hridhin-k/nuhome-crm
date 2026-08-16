import type { ReactNode } from "react";
import { AppNavbar, MobileBottomNav } from "@/components/app/app-nav";
import { WalkInFab } from "@/components/app/walk-in-fab";
import { PrefetchRoutes } from "@/components/app/prefetch-routes";
import { listNotifications } from "@/lib/api/notifications";
import { requireUser } from "@/lib/auth/guards";
import { navForRoles, roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const items = navForRoles(user.roles, user.role);
  const notifications = await listNotifications(user.id).catch(() => []);
  const canQuote = rolesHavePermission(user.roles, "quotes.create");
  const canAdmin = rolesHavePermission(user.roles, "admin.manage");
  const warm = [
    ...items.map((item) => item.href),
    ...(canQuote ? ["/walk-in", "/customers/new"] : []),
    ...(canAdmin ? ["/users", "/vendors", "/materials", "/company", "/reports"] : []),
  ];

  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-clip bg-background text-on-background">
      <div className="print:hidden">
      <AppNavbar
        items={items}
        name={user.fullName}
        role={roleLabels(user.roles)}
        userId={user.id}
        notifications={notifications}
      />
      </div>

      <main className="min-w-0 flex-1 overflow-x-clip overflow-y-auto bg-background px-4 pt-0 pb-[calc(5.5rem+env(safe-area-inset-bottom))] print:bg-white print:px-0 print:pb-0 md:px-8 md:pt-6 md:pb-10">
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
