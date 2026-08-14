import { AccountSheet } from "@/components/app/account-sheet";
import { PageHeader } from "@/components/app/page-header";
import { requireUser } from "@/lib/auth/guards";
import { roleLabel } from "@/lib/auth/nav";

export default async function MorePage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader title="More" description="Account and sign out." />
      <AccountSheet
        name={user.fullName}
        email={user.email}
        role={roleLabel(user.role)}
      />
    </div>
  );
}
