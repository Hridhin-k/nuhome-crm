import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { JobRow } from "@/components/app/job-row";
import { logoutAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { roleLabel } from "@/lib/auth/nav";

const ADMIN_LINKS = [
  { href: "/users", label: "Users", subtitle: "Add staff and assign roles" },
  { href: "/vendors", label: "Vendors", subtitle: "Suppliers for fulfillment" },
  { href: "/materials", label: "Materials", subtitle: "Quote catalogue" },
  { href: "/reports", label: "Reports", subtitle: "Pipeline snapshot" },
] as const;

export default async function MorePage() {
  const user = await requireUser();
  const initials = user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <PageFrame width="detail">
      <PageHeader title="More" />
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-outline-variant bg-card p-4 shadow-card">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-headline-md text-primary">
          {initials || "N"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-subheading text-on-surface">
            {user.fullName}
          </p>
          {user.email ? (
            <p className="truncate text-body-sm text-on-surface-variant">
              {user.email}
            </p>
          ) : null}
          <span className="mt-1 inline-flex rounded-full bg-surface-container-low px-2 py-0.5 text-label-caps text-secondary">
            {roleLabel(user.role)}
          </span>
        </div>
      </div>
      {user.role === "admin" ? (
        <ul className={`${wellClass} mb-6`}>
          {ADMIN_LINKS.map((link) => (
            <JobRow
              key={link.href}
              href={link.href}
              title={link.label}
              subtitle={link.subtitle}
              stacked
            />
          ))}
        </ul>
      ) : null}
      <form action={logoutAction}>
        <Button type="submit" variant="bordered" className="w-full" size="lg">
          Sign out
        </Button>
      </form>
    </PageFrame>
  );
}
