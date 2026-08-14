import type { ReactNode } from "react";
import { AppNavbar, MobileBottomNav } from "@/components/app/app-nav";
import { PrefetchRoutes } from "@/components/app/prefetch-routes";
import { WorkflowRefreshListener } from "@/components/app/workflow-refresh-listener";
import { listNotifications } from "@/lib/api/notifications";
import { requireUser } from "@/lib/auth/guards";
import { navForRole, roleLabel } from "@/lib/auth/nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const items = navForRole(user.role);
  const [notifications] = await Promise.all([
    listNotifications(user.id).catch(() => []),
  ]);
  const warm = [
    ...items.map((item) => item.href),
    ...(user.role === "sales" || user.role === "admin"
      ? ["/walk-in", "/customers/new"]
      : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-on-background">
      <AppNavbar
        items={items}
        name={user.fullName}
        role={roleLabel(user.role)}
        userId={user.id}
        notifications={notifications}
      />

      <main className="flex-1 overflow-y-auto bg-surface-container-lowest px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-10">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>

      <MobileBottomNav items={items} />
      <WorkflowRefreshListener />
      <PrefetchRoutes hrefs={warm} />
    </div>
  );
}
