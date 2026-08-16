import { StatusFilterNav } from "@/components/app/status-filter-nav";
import { pathWithQuery } from "@/lib/search";
import {
  ORDER_BUCKET_IDS,
  ORDER_BUCKET_LABELS,
  type OrderBucketId,
} from "@/lib/workflow/status-buckets";

export function OrderBucketNav({
  active,
  extra,
}: {
  active: OrderBucketId;
  extra?: Record<string, string | undefined>;
}) {
  return (
    <StatusFilterNav
      ariaLabel="Order status"
      active={active}
      items={ORDER_BUCKET_IDS.map((id) => ({
        id,
        label: ORDER_BUCKET_LABELS[id],
      }))}
      hrefFor={(id) =>
        id === "open"
          ? pathWithQuery("/orders", extra ?? {})
          : pathWithQuery("/orders", { ...(extra ?? {}), bucket: id })
      }
    />
  );
}
