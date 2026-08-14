import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/workflow/types";

export type SessionUser = {
  id: string;
  email: string | undefined;
  fullName: string;
  role: AppRole;
  isActive: boolean;
};

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to fetch profile");
  }

  return {
    id: user.id,
    email: user.email,
    fullName: profile?.full_name ?? user.email ?? "User",
    role: (profile?.role as AppRole | undefined) ?? "sales",
    isActive: profile?.is_active ?? true,
  };
});
