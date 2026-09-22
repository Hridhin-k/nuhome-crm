import { PageFrame, wellClass } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { JobRow } from "@/components/app/job-row";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { InstallHint } from "@/components/pwa/install-hint";
import { logoutAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/guards";
import { overflowNavForRoles, roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";

const MANAGE_LINKS = [
  { href: "/users", label: "Users", subtitle: "Staff, extra hats, cover for leave" },
  { href: "/vendors", label: "Vendors", subtitle: "Edit, contacts, CSV import" },
  { href: "/materials", label: "Materials", subtitle: "HSN, GST, warranty, descriptions" },
  { href: "/company", label: "Company", subtitle: "GSTIN on tax invoices" },
  { href: "/reports", label: "Reports", subtitle: "Floor, collections, aging, audit" },
] as const;

const FLOOR_LINKS = [
  {
    href: "/approvals",
    label: "Approvals",
    subtitle: "Quotes waiting for review",
    permission: "quotes.approve" as const,
  },
  {
    href: "/payments",
    label: "Payments",
    subtitle: "Verify receipts",
    permission: "payments.verify" as const,
  },
  {
    href: "/fulfillment",
    label: "Fulfillment",
    subtitle: "Send and chase vendors",
    permission: "orders.send_to_vendor" as const,
  },
  {
    href: "/customers",
    label: "Customers",
    subtitle: "Book and update customers",
    permission: "customers.read" as const,
  },
  {
    href: "/leads",
    label: "Leads",
    subtitle: "Follow-up book",
    permission: "leads.manage" as const,
  },
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
  const canCatalog = rolesHavePermission(user.roles, "catalog.manage");
  const canStaff = rolesHavePermission(user.roles, "staff.manage");
  const canReports = rolesHavePermission(user.roles, "reports.read");
  const canVendors =
    canCatalog ||
    canAdmin ||
    rolesHavePermission(user.roles, "orders.send_to_vendor");

  const floorLinks = FLOOR_LINKS.filter((link) =>
    rolesHavePermission(user.roles, link.permission),
  );

  // Reports sits on the Ops/Admin bar — keep it in More for other hats.
  const showReportsInMore =
    canReports &&
    !user.roles.includes("operations") &&
    !user.roles.includes("admin");

  const manageLinks = [
    ...(canStaff ? [MANAGE_LINKS[0]] : []),
    ...(canVendors ? [MANAGE_LINKS[1]] : []),
    ...(canCatalog ? [MANAGE_LINKS[2], MANAGE_LINKS[3]] : []),
    ...(showReportsInMore ? [MANAGE_LINKS[4]] : []),
  ];

  const knownHrefs = new Set<string>([
    ...floorLinks.map((link) => link.href),
    ...manageLinks.map((link) => link.href),
  ]);
  const extraLinks = extras.filter((item) => !knownHrefs.has(item.href));

  return (
    <PageFrame width="detail">
      <PageHeader title="More" />
      <InstallHint />
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-headline-md text-on-secondary-container">
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
          <span className="mt-1 inline-flex items-center rounded-full bg-secondary-container px-2.5 py-0.5 text-label-caps text-on-secondary-container">
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
      {floorLinks.length > 0 ? (
        <ul className={`${wellClass} mb-6`}>
          {floorLinks.map((link) => (
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
      {manageLinks.length > 0 ? (
        <ul className={`${wellClass} mb-6`}>
          {manageLinks.map((link) => (
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
