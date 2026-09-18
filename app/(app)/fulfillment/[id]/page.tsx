import { notFound } from "next/navigation";
import { dispatchAction } from "@/app/actions/workflow";
import { ConfirmActionSheet } from "@/components/app/confirm-action-sheet";
import { Notice } from "@/components/app/notice";
import {
  rememberFulfillmentScroll,
  ScrollToFocus,
} from "@/components/app/scroll-to-focus";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { VendorCommercialForm } from "@/components/fulfillment/vendor-commercial-form";
import {
  ReceiveItemsForm,
  SendToVendorForm,
  WriteOffItemsForm,
} from "@/components/fulfillment/vendor-forms";
import { listVendors } from "@/lib/api/catalog";
import { getOrder } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { displaySpecification } from "@/lib/quotes/spec";
import { requirePermission } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import {
  availableToSend,
  formatExpectedDate,
  isVendorOrderOverdue,
  unaccountedQty,
  vendorBatchStepperLabel,
} from "@/lib/workflow/fulfillment";

export default async function FulfillmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string; focus?: string }>;
}) {
  const user = await requirePermission("fulfillment.update");
  const { id } = await params;
  const { notice, error, focus } = await searchParams;
  const [detail, vendors] = await Promise.all([getOrder(id), listVendors()]);
  if (!detail) {
    notFound();
  }

  const descriptions = new Map(
    detail.items.map((item) => [item.id, item.description]),
  );
  const quoteLineByOrderItem = new Map(
    detail.items.map((item) => {
      const qi = rel(item.quote_items);
      return [
        item.id,
        {
          description: qi?.description ?? item.description,
          item_code: qi?.item_code ?? null,
          specification: displaySpecification(
            qi?.specification,
            qi?.description ?? item.description,
          ),
        },
      ] as const;
    }),
  );
  const quoteNotes = rel(detail.quote?.quote_versions)?.notes ?? null;
  const allocatedByItem = new Map<string, number>();
  for (const vendorOrder of detail.vendorOrders) {
    const lines = Array.isArray(vendorOrder.vendor_order_items)
      ? vendorOrder.vendor_order_items
      : vendorOrder.vendor_order_items
        ? [vendorOrder.vendor_order_items]
        : [];
    for (const line of lines) {
      if (!line.order_item_id) continue;
      allocatedByItem.set(
        line.order_item_id,
        (allocatedByItem.get(line.order_item_id) ?? 0) + Number(line.quantity),
      );
    }
  }

  const sendItems = detail.items.map((item) => ({
    id: item.id,
    description: item.description,
    available: availableToSend({
      quantity: Number(item.quantity),
      allocated: allocatedByItem.get(item.id) ?? 0,
      quantity_written_off: Number(item.quantity_written_off ?? 0),
    }),
    unit_cost: Number(rel(item.quote_items)?.unit_cost ?? 0),
  }));
  const closeItems = detail.items.map((item) => ({
    id: item.id,
    description: item.description,
    remaining: unaccountedQty({
      quantity: Number(item.quantity),
      quantity_received: Number(item.quantity_received),
      quantity_written_off: Number(item.quantity_written_off ?? 0),
    }),
  }));
  const canSend = rolesHavePermission(user.roles, "orders.send_to_vendor");
  const canApproveQuote = rolesHavePermission(user.roles, "vendors.quote_approve");
  const canClose =
    detail.vendorOrders.length > 0 &&
    closeItems.some((item) => item.remaining > 0);

  return (
    <PageFrame width="detail" className="flex flex-col gap-5">
      <PageHeader
        title={detail.order.order_number}
        description={[detail.quote?.quote_number, detail.customer?.name]
          .filter(Boolean)
          .join(" · ")}
      />
      {notice === "allocated" ? (
        <Notice>Vendor split saved. Accounts must verify each vendor quote before send.</Notice>
      ) : null}
      {notice === "quoted" ? <Notice>Vendor quote logged. Waiting for approval.</Notice> : null}
      {notice === "quote-decided" ? <Notice>Vendor quote decision saved.</Notice> : null}
      {notice === "sent-vendor" ? <Notice>Sent to vendor.</Notice> : null}
      {notice === "dispatched" ? <Notice>Marked as dispatched.</Notice> : null}
      {notice === "vendor-quoted" ? <Notice>Vendor quote saved.</Notice> : null}
      {notice === "vendor-bill" ? <Notice>Vendor bill saved.</Notice> : null}
      {notice === "vendor-paid" ? <Notice>Vendor marked as paid.</Notice> : null}
      {notice === "written-off" ? (
        <Notice>Remainder closed. Delivery can proceed if nothing is left open.</Notice>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ScrollToFocus focus={focus} />

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-[16px] font-semibold text-on-surface">Lines</h2>
        <ul className="mt-3 divide-y divide-surface-variant">
          {detail.items.map((item) => {
            const written = Number(item.quantity_written_off ?? 0);
            return (
              <li key={item.id} className="flex min-w-0 justify-between gap-3 py-2.5 text-[13px]">
                <span className="min-w-0 break-words">{item.description}</span>
                <span className="shrink-0 text-right text-[12px] text-on-surface-variant">
                  {Number(item.quantity_received)}/{Number(item.quantity)} received
                  {written > 0
                    ? ` · ${written} ${item.write_off_reason ?? "closed"}`
                    : ""}
                  <span className="mt-1 block text-xs">
                    Unsent{" "}
                    {availableToSend({
                      quantity: Number(item.quantity),
                      allocated: allocatedByItem.get(item.id) ?? 0,
                      quantity_written_off: written,
                    })}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {canSend ? (
        <SendToVendorForm
          orderId={detail.order.id}
          orderNumber={detail.order.order_number}
          vendors={vendors}
          items={sendItems}
        />
      ) : null}

      {detail.vendorOrders.map((vendorOrder) => {
        const vendorName = rel(vendorOrder.vendors)?.name ?? "Vendor";
        const overdue = isVendorOrderOverdue({
          expected_delivery_at: vendorOrder.expected_delivery_at,
          status: vendorOrder.status,
        });
        const lines = Array.isArray(vendorOrder.vendor_order_items)
          ? vendorOrder.vendor_order_items
          : vendorOrder.vendor_order_items
            ? [vendorOrder.vendor_order_items]
            : [];
        const expected = formatExpectedDate(vendorOrder.expected_delivery_at);
        const stepper = vendorBatchStepperLabel({
          status: vendorOrder.status,
          commercial_status: vendorOrder.commercial_status,
        });
        const vendorPays = Array.isArray(vendorOrder.vendor_payments)
          ? vendorOrder.vendor_payments
          : vendorOrder.vendor_payments
            ? [vendorOrder.vendor_payments]
            : [];
        const lastPay = vendorPays[0];
        return (
          <section
            key={vendorOrder.id}
            id={`vendor-${vendorOrder.id}`}
            className="scroll-mt-24 rounded-lg border border-border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-on-surface">{vendorName}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {stepper}
                  {expected ? ` · expected ${expected}` : ""}
                </p>
              </div>
              {overdue ? (
                <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                  Overdue
                </span>
              ) : null}
            </div>
            <ul className="mt-3 divide-y divide-surface-variant text-sm">
              {lines.map((line) => (
                <li
                  key={line.id}
                  className="flex justify-between py-2 text-on-surface-variant"
                >
                  <span>
                    {quoteLineByOrderItem.get(line.order_item_id ?? "")?.description ??
                      descriptions.get(line.order_item_id ?? "") ??
                      "Item"}
                    {quoteLineByOrderItem.get(line.order_item_id ?? "")?.item_code
                      ? ` · ${quoteLineByOrderItem.get(line.order_item_id ?? "")?.item_code}`
                      : ""}
                  </span>
                  <span>
                    {Number(line.quantity_received)}/{Number(line.quantity)}
                    {Number(line.quantity_written_off ?? 0) > 0
                      ? ` · ${Number(line.quantity_written_off)} closed`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
            <VendorCommercialForm
              orderId={detail.order.id}
              vendorOrderId={vendorOrder.id}
              quoteRef={vendorOrder.quote_ref}
              quoteAmount={vendorOrder.quote_amount}
              billRef={vendorOrder.bill_ref}
              billAmount={vendorOrder.bill_amount}
              commercialStatus={vendorOrder.commercial_status}
              physicalStatus={vendorOrder.status}
              quoteRejectionReason={vendorOrder.quote_rejection_reason}
              canSend={canSend}
              canApproveQuote={canApproveQuote}
              paidAmount={lastPay?.amount}
              paidReference={lastPay?.reference_number}
              paidMethod={lastPay?.method}
              quoteNotes={quoteNotes}
              lines={lines.map((line) => {
                const meta = quoteLineByOrderItem.get(line.order_item_id ?? "");
                return {
                  description: meta?.description ?? descriptions.get(line.order_item_id ?? "") ?? "Item",
                  item_code: meta?.item_code,
                  specification: meta?.specification,
                  quantity: Number(line.quantity),
                };
              })}
            />
            <div className="mt-4 flex flex-col gap-2">
              {vendorOrder.status === "sent" &&
              vendorOrder.commercial_status === "vendor_paid" ? (
                <ConfirmActionSheet
                  title="Mark dispatched"
                  description={`${vendorName} is sending this batch.`}
                  triggerLabel="Mark dispatched"
                  confirmLabel="Confirm dispatch"
                  action={dispatchAction.bind(
                    null,
                    vendorOrder.id,
                    detail.order.id,
                  )}
                  onSubmit={rememberFulfillmentScroll}
                />
              ) : vendorOrder.status === "sent" ? (
                <p className="text-sm text-on-surface-variant">
                  Mark the vendor paid before dispatch.
                </p>
              ) : null}
              {vendorOrder.status === "dispatched" ? (
                <ReceiveItemsForm
                  orderId={detail.order.id}
                  vendorOrderId={vendorOrder.id}
                  items={lines.map((line) => ({
                    order_item_id: line.order_item_id ?? "",
                    description:
                      descriptions.get(line.order_item_id ?? "") ?? "Item",
                    remaining: Math.max(
                      0,
                      Number(line.quantity) -
                        Number(line.quantity_received) -
                        Number(line.quantity_written_off ?? 0),
                    ),
                  }))}
                />
              ) : null}
            </div>
          </section>
        );
      })}

      {canClose ? (
        <WriteOffItemsForm orderId={detail.order.id} items={closeItems} />
      ) : null}
    </PageFrame>
  );
}
