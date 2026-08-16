import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { JobRow } from "@/components/app/job-row";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { logoutAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { overflowNavForRoles, roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";

const ADMIN_LINKS = [
  { href: "/users", label: "Users", subtitle: "Staff, extra hats, cover for leave" },
  { href: "/vendors", label: "Vendors", subtitle: "Edit, contacts, deactivate" },
  { href: "/materials", label: "Materials", subtitle: "HSN, GST, warranty term" },
  { href: "/company", label: "Company", subtitle: "GSTIN on tax invoices" },
  { href: "/reports", label: "Reports", subtitle: "Collections, aging, audit" },
] as const;

export default async function MorePage() {
  const user = await requireUser();
  const initials = user.fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const extras = overflowNavForRoles(user.roles, user.role);
  const canAdmin = rolesHavePermission(user.roles, "admin.manage");
  const extraLinks = extras.filter(
    (item) =>
      !ADMIN_LINKS.some((link) => link.href === item.href),
  );

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
            {roleLabels(user.roles)}
          </span>
        </div>
      </div>
      {extraLinks.length > 0 ? (
        <ul className={`${wellClass} mb-6`}>
          {extraLinks.map((link) => (
            <JobRow
              key={link.href}
              href={link.href}
              title={link.label}
              subtitle="From an extra role"
              stacked
            />
          ))}
        </ul>
      ) : null}
      {canAdmin ? (
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
      <div className="mb-3">
        <ChangePasswordForm />
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="bordered" className="w-full" size="lg">
          Sign out
        </Button>
      </form>
    </PageFrame>
  );
}
