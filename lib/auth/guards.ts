import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { roleHasPermission } from "@/lib/auth/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isActive) {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut();
    redirect("/login");
  }
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireUser();
  if (!roleHasPermission(user.role, permission)) {
    redirect("/home");
  }
  return user;
}
