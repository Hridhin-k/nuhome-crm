import { APP_ROLES, type AppRole } from "@/lib/workflow/types";

export function parseAppRole(value: string | null | undefined): AppRole | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "delivery") return "store";
  if ((APP_ROLES as readonly string[]).includes(normalized)) {
    return normalized as AppRole;
  }
  return null;
}

export function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}
