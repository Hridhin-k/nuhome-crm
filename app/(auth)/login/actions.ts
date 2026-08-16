"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
} from "@/lib/validation/auth";
import { appOrigin } from "@/lib/auth/origin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
  notice?: string;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Email or password is incorrect" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return { error: "This account is inactive. Ask an admin to restore access." };
    }
  }

  const nextRaw = formString(formData, "next");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/home";

  redirect(next);
}

export async function forgotPasswordAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formString(formData, "email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  }

  const origin = appOrigin(await headers());
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/update-password")}`,
  });
  if (error) {
    return { error: "Could not send a reset email. Ask an admin to set a new password." };
  }
  return { notice: "If that email is on file, we sent a reset link." };
}

export async function changePasswordAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = changePasswordSchema.safeParse({
    current_password: formString(formData, "current_password"),
    new_password: formString(formData, "new_password"),
    confirm_password: formString(formData, "confirm_password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) {
    return { error: "You need to be signed in" };
  }
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.current_password,
  });
  if (checkError) {
    return { error: "Current password is incorrect" };
  }
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) {
    return { error: error.message };
  }
  return { notice: "Password updated." };
}

export async function setNewPasswordAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = formString(formData, "password");
  const confirm = formString(formData, "confirm_password");
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }
  if (password !== confirm) {
    return { error: "Passwords do not match" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }
  redirect("/home");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
