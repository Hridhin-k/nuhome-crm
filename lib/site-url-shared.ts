function isLocalHost(host: string) {
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local")
  );
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
