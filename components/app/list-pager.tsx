import { AppLink } from "@/components/app/app-link";

export function ListPager({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (total <= pageSize) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  return (
    <nav
      className="mt-4 flex items-center justify-between gap-3 text-sm text-on-surface-variant"
      aria-label="Pages"
    >
      {current > 1 ? (
        <AppLink href={hrefFor(current - 1)} className="font-medium text-primary">
          Previous
        </AppLink>
      ) : (
        <span>Previous</span>
      )}
      <span className="tabular-nums">
        {current} / {pages}
      </span>
      {current < pages ? (
        <AppLink href={hrefFor(current + 1)} className="font-medium text-primary">
          Next
        </AppLink>
      ) : (
        <span>Next</span>
      )}
    </nav>
  );
}
