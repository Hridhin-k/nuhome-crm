import { notFound } from "next/navigation";
import { dispatchAction } from "@/app/actions/workflow";
import { ConfirmActionSheet } from "@/components/app/confirm-action-sheet";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import {
  ReceiveItemsForm,
  SendToVendorForm,
} from "@/components/fulfillment/vendor-forms";
import { listVendors } from "@/lib/api/catalog";
import { getOrder } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";

export default async function FulfillmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  await requirePermission("fulfillment.update");
  const { id } = await params;
  const { notice, error } = await searchParams;
  const [detail, vendors] = await Promise.all([getOrder(id), listVendors()]);
  if (!detail) {
    notFound();
  }

  const latestVendor = detail.vendorOrders[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={detail.quote?.quote_number ?? "Fulfillment"}
        description={detail.customer?.name}
      />
      {notice === "sent-vendor" ? <Notice>Sent to vendor.</Notice> : null}
      {notice === "dispatched" ? <Notice>Marked as dispatched.</Notice> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {detail.order.status === "order_active" ? (
        <SendToVendorForm
          orderId={detail.order.id}
          vendors={vendors}
          items={detail.items.map((i) => ({
            id: i.id,
            description: i.description,
            quantity: Number(i.quantity),
          }))}
        />
      ) : null}

      {detail.order.status === "sent_to_vendor" && latestVendor ? (
        <ConfirmActionSheet
          title="Mark dispatched"
          description={`Vendor ${rel(latestVendor.vendors)?.name ?? ""} is sending this order.`}
          triggerLabel="Mark dispatched"
          confirmLabel="Confirm dispatch"
          action={dispatchAction.bind(null, latestVendor.id, detail.order.id)}
        />
      ) : null}

      {detail.order.status === "vendor_dispatched" && latestVendor ? (
        <ReceiveItemsForm
          orderId={detail.order.id}
          vendorOrderId={latestVendor.id}
          items={detail.items.map((i) => ({
            id: i.id,
            description: i.description,
            quantity: Number(i.quantity),
            quantity_received: Number(i.quantity_received),
          }))}
        />
      ) : null}
    </div>
  );
}
