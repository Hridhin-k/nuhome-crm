export function publicQuotePath(token: string) {
  return `/q/${token}`;
}

export function publicQuoteUrl(siteUrl: string, token: string) {
  return `${siteUrl}${publicQuotePath(token)}`;
}
