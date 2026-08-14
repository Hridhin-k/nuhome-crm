import type { ReactNode } from "react";
import { DesktopSidebar, MobileBottomNav } from "@/components/app/app-nav";
import { PrefetchRoutes } from "@/components/app/prefetch-routes";
import { requireUser } from "@/lib/auth/guards";
import { navForRole, roleLabel } from "@/lib/auth/nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const items = navForRole(user.role);
  const warm = [
    ...items.map((item) => item.href),
    ...(user.role === "sales" || user.role === "admin"
      ? ["/walk-in", "/customers/new"]
      : []),
  ];

  return (
    <div className="flex min-h-dvh bg-background text-on-background">
      <DesktopSidebar
        items={items}
        name={user.fullName}
        role={roleLabel(user.role)}
      />

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-11 items-center justify-between border-b border-outline-variant bg-surface px-4 md:hidden">
          <p className="text-[16px] font-bold text-primary">Enterprise Manager</p>
          <p className="text-label-md text-on-surface-variant">
            {roleLabel(user.role)}
          </p>
        </header>

        <main className="flex-1 overflow-y-auto bg-surface-container-lowest px-4 py-6 pb-28 md:px-12 md:py-10 md:pb-10">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <MobileBottomNav items={items} />
      <PrefetchRoutes hrefs={warm} />
    </div>
  );
}
