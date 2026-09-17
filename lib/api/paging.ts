export const LIST_PAGE_SIZE = 40;

export type ListPage<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function emptyPage<T>(page: number, pageSize = LIST_PAGE_SIZE): ListPage<T> {
  return { rows: [], total: 0, page, pageSize };
}

export function pageRange(page: number, pageSize = LIST_PAGE_SIZE) {
  const safe = Math.max(1, page);
  const from = (safe - 1) * pageSize;
  return { from, to: from + pageSize - 1, page: safe, pageSize };
}
