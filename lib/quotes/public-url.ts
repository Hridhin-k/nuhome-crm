export function publicQuotePath(token: string) {
  return `/q/${token}`;
}

export function publicQuoteUrl(siteUrl: string, token: string) {
  return `${siteUrl}${publicQuotePath(token)}`;
}

export function publicInvoicePath(token: string) {
  return `${publicQuotePath(token)}/invoice`;
}

export function publicInvoiceUrl(siteUrl: string, token: string) {
  return `${siteUrl}${publicInvoicePath(token)}`;
}
