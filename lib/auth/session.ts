import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { relList } from "@/lib/api/rel";
import { parseAppRole } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/workflow/types";

export type SessionUser = {
  id: string;
  email: string | undefined;
  fullName: string;
  role: AppRole;
  roles: AppRole[];
  isActive: boolean;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    return null;
  }

  const email = claims.email;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, is_active, profile_roles(role)")
    .eq("id", claims.sub)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to fetch profile");
  }

  const primary = (profile?.role as AppRole | undefined) ?? "sales";
  const extra = relList(profile?.profile_roles)
    .map((row) => parseAppRole(row.role))
    .filter((role): role is AppRole => Boolean(role));
  const roles = extra.includes(primary) ? extra : [primary, ...extra];

  return {
    id: claims.sub,
    email,
    fullName: profile?.full_name ?? email ?? "User",
    role: primary,
    roles: roles.length > 0 ? roles : [primary],
    isActive: profile?.is_active ?? true,
  };
});
