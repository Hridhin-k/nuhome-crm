import { PageHeader } from "@/components/app/page-header";
import { listProfiles } from "@/lib/api/catalog";
import { requirePermission } from "@/lib/auth/guards";
import { roleLabel } from "@/lib/auth/nav";
import type { AppRole } from "@/lib/workflow/types";

export default async function UsersPage() {
  await requirePermission("admin.manage");
  const profiles = await listProfiles();

  return (
    <div>
      <PageHeader
        title="Users"
        description="Roles are assigned here. New logins start as Sales."
      />
      <ul className="flex flex-col gap-3">
        {profiles.map((profile) => (
          <li
            key={profile.id}
            className="rounded-xl border border-surface-variant bg-surface-container-lowest px-4 py-4"
          >
            <p className="font-medium">{profile.full_name || "Unnamed"}</p>
            <p className="text-sm text-on-surface-variant">
              {roleLabel(profile.role as AppRole)}
              {profile.is_active ? "" : " · inactive"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
