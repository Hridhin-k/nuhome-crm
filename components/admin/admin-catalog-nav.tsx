import { AppLink } from "@/components/app/app-link";
import { requireUser } from "@/lib/auth/guards";
import { rolesHavePermission, type Permission } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/workflow/types";
import { cn } from "@/lib/utils";

const ITEMS = [
  {
    href: "/users",
    label: "Users",
    permissions: ["staff.manage", "admin.manage"],
  },
  {
    href: "/vendors",
    label: "Vendors",
    permissions: ["catalog.manage", "admin.manage", "orders.send_to_vendor"],
  },
  {
    href: "/materials",
    label: "Materials",
    permissions: ["catalog.manage", "admin.manage", "materials.manage"],
  },
  {
    href: "/company",
    label: "Company",
    permissions: ["catalog.manage", "admin.manage"],
  },
] as const satisfies readonly {
  href: string;
  label: string;
  permissions: readonly Permission[];
}[];

function canOpen(
  roles: AppRole[],
  permissions: readonly Permission[],
) {
  return permissions.some((permission) => rolesHavePermission(roles, permission));
}

export async function AdminCatalogNav({
  current,
}: {
  current: (typeof ITEMS)[number]["href"];
}) {
  const user = await requireUser();
  const visible = ITEMS.filter((item) => canOpen(user.roles, item.permissions));
  if (visible.length < 2) return null;

  return (
    <nav
      aria-label="Catalog"
      className="mb-6 flex gap-2 overflow-x-auto pb-1"
    >
      {visible.map((item) => (
        <AppLink
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-full border px-4 py-1.5 text-subheading whitespace-nowrap transition-colors",
            current === item.href
              ? "border-primary bg-primary text-on-primary"
              : "border-outline-variant bg-card text-on-surface hover:bg-muted",
          )}
        >
          {item.label}
        </AppLink>
      ))}
    </nav>
  );
}
