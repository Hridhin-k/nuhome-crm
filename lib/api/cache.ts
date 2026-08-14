/** Cache intent for every server read. CRM rows stay live; catalogs can age a few minutes. */
export const LIVE = { cache: "no-store" as const };

export const CATALOG: {
  next: { revalidate: number; tags: string[] };
} = {
  next: { revalidate: 300, tags: ["catalog"] },
};

export type FetchCache = typeof LIVE | typeof CATALOG;
