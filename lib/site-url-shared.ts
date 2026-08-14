function isLocalHost(host: string) {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

export function isLocalSiteUrl(url: string) {
  try {
    const { hostname } = new URL(url);
    return isLocalHost(hostname);
  } catch {
    return false;
  }
}

export function isLocalHostName(host: string) {
  return isLocalHost(host);
}

/** URL embedded in customer WhatsApp links — never localhost when a public URL is configured. */
export function resolveCustomerSiteUrl(input: {
  host?: string | null;
  forwardedProto?: string | null;
}) {
  const customerConfigured = process.env.NEXT_PUBLIC_CUSTOMER_APP_URL?.trim();
  if (customerConfigured) {
    return normalizeBaseUrl(customerConfigured);
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && !isLocalSiteUrl(configured)) {
    return normalizeBaseUrl(configured);
  }

  const host = input.host;
  if (!host) {
    return "http://localhost:3000";
  }

  const proto = isLocalHost(host)
    ? "http"
    : (input.forwardedProto ?? "https");
  return `${proto}://${host}`;
}
