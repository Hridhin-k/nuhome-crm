import { AccountSheet } from "@/components/app/account-sheet";
import { AppLink } from "@/components/app/app-link";
import { PageHeader } from "@/components/app/page-header";
import { requireUser } from "@/lib/auth/guards";
import { roleLabel } from "@/lib/auth/nav";

const ADMIN_LINKS = [
  { href: "/users", label: "Users", detail: "Add staff and assign roles" },
  { href: "/vendors", label: "Vendors", detail: "Suppliers for fulfillment" },
  { href: "/materials", label: "Materials", detail: "Quote catalogue" },
  { href: "/reports", label: "Reports", detail: "Pipeline snapshot" },
];

export default async function MorePage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader title="More" description="Account and sign out." />
      {user.role === "admin" ? (
        <ul className="mb-4 flex flex-col gap-3">
          {ADMIN_LINKS.map((link) => (
            <li key={link.href}>
              <AppLink
                href={link.href}
                className="block rounded-xl border border-surface-variant bg-surface-container-lowest p-5"
              >
                <p className="font-medium">{link.label}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{link.detail}</p>
              </AppLink>
            </li>
          ))}
        </ul>
      ) : null}
      <AccountSheet
        name={user.fullName}
        email={user.email}
        role={roleLabel(user.role)}
      />
    </div>
  );
}
