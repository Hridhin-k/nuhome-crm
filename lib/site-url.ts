import { headers } from "next/headers";
import { isLocalHostName } from "@/lib/site-url-shared";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

export function resolveSiteUrl(input: {
  host?: string | null;
  forwardedProto?: string | null;
}) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  const host = input.host;
  if (!host) {
    return "http://localhost:3000";
  }

  const proto = isLocalHostName(host)
    ? "http"
    : (input.forwardedProto ?? "https");
  return `${proto}://${host}`;
}

export async function getSiteUrl() {
  const h = await headers();
  return resolveSiteUrl({
    host: h.get("x-forwarded-host") ?? h.get("host"),
    forwardedProto: h.get("x-forwarded-proto"),
  });
}

export { isLocalSiteUrl } from "@/lib/site-url-shared";
