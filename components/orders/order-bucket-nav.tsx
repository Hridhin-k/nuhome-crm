import { StatusFilterNav } from "@/components/app/status-filter-nav";
import {
  ORDER_BUCKET_IDS,
  ORDER_BUCKET_LABELS,
  type OrderBucketId,
} from "@/lib/workflow/status-buckets";

export function OrderBucketNav({ active }: { active: OrderBucketId }) {
  return (
    <StatusFilterNav
      ariaLabel="Order status"
      active={active}
      items={ORDER_BUCKET_IDS.map((id) => ({
        id,
        label: ORDER_BUCKET_LABELS[id],
      }))}
      hrefFor={(id) => (id === "open" ? "/orders" : `/orders?bucket=${id}`)}
    />
  );
}
