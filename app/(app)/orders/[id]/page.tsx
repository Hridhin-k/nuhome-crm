import { AppLink } from "@/components/app/app-link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { Notice } from "@/components/app/notice";
import { NextActionCard } from "@/components/app/next-action-card";
import { PageFrame, panelClass } from "@/components/app/page-frame";
import { CompleteDeliveryForm } from "@/components/deliveries/complete-form";
import { AttachmentPanel } from "@/components/documents/attachment-panel";
import { InstallationForm } from "@/components/documents/installation-form";
import { WarrantyPanel } from "@/components/documents/warranty-form";
import { HoldCard } from "@/components/orders/hold-card";
import { OrderHero } from "@/components/orders/order-hero";
import { ReassignOrderForm } from "@/components/orders/reassign-order-form";
import { CancelJobSheet } from "@/components/quotes/cancel-sheet";
import { PaymentForm } from "@/components/payments/payment-form";
import { PaymentReviewActions } from "@/components/payments/payment-review-actions";
import { listOrderActivity } from "@/lib/api/audit";
import { listCoverSales, listProfiles } from "@/lib/api/catalog";
import {
  getInstallationForOrder,
  listAttachments,
  listWarrantiesForOrder,
} from "@/lib/api/documents";
import { getOrder } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { formatInrExact } from "@/lib/format/money";
import { canCancelJob } from "@/lib/workflow/cancel";
import { nextRequiredAction } from "@/lib/workflow/next-action";
import {
  canRecordPayment,
  pendingPaymentMessage,
} from "@/lib/workflow/payment-recording";
import { orderStatusExplanation } from "@/lib/workflow/status-explanation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { notice, error } = await searchParams;
  const canReassign = rolesHavePermission(user.roles, "admin.manage");
  const canAftercare =
    rolesHavePermission(user.roles, "quotes.create") ||
    rolesHavePermission(user.roles, "deliveries.complete");
  const [detail, activity, profiles, files, installation, warranties] =
    await Promise.all([
      getOrder(id),
      listOrderActivity(id).catch(() => []),
      canReassign ? listProfiles() : Promise.resolve([]),
      listAttachments("order", id).catch(() => []),
      getInstallationForOrder(id).catch(() => null),
      listWarrantiesForOrder(id).catch(() => []),
    ]);
  if (!detail) {
    notFound();
  }

  const { order, customer, quote, items, vendorOrders, delivery, balance, payments } =
    detail;
  const status = order.status as WorkflowStatus;
  const outstanding = Number(balance?.outstanding ?? 0);
  const total = Number(balance?.order_total ?? 0);
  const paid = Number(balance?.verified_payments ?? 0);
  const next = nextRequiredAction({
    status,
    role: user.role,
    roles: user.roles,
    outstanding,
    orderId: order.id,
    quoteId: order.quote_id,
    activated: Boolean(order.activated_at),
    payments,
    hasInstallation: Boolean(installation),
  });
  const showRecordPayment =
    rolesHavePermission(user.roles, "payments.record") &&
    canRecordPayment({ status, payments, outstanding });
  const paymentWaitingMessage = pendingPaymentMessage(payments);
  const version = rel(quote?.quote_versions);
  const canCancel = canCancelJob({
    quoteStatus: (quote?.status as WorkflowStatus) ?? status,
    orderStatus: status,
    roles: user.roles,
  });
  const statusExplanation = orderStatusExplanation({
    status,
    outstanding,
    activated: Boolean(order.activated_at),
  });

  return (
    <PageFrame width="detail" className="flex flex-col gap-4">
      {notice === "reassigned" ? (
        <Notice>Order moved to covering sales.</Notice>
      ) : null}
      {notice === "payment" ? (
        <Notice>Payment recorded. Waiting for Accounts to verify.</Notice>
      ) : null}
      {notice === "verified" ? <Notice>Payment verified.</Notice> : null}
      {notice === "payment-rejected" ? (
        <Notice>Payment sent back to Sales. They can record a corrected entry.</Notice>
      ) : null}
      {notice === "received" ? (
        <Notice>Items received. Delivery gate applied.</Notice>
      ) : null}
      {notice === "sent" ? (
        <Notice>Approved quote sent. Record payment terms next.</Notice>
      ) : null}
      {notice === "uploaded" ? <Notice>File uploaded.</Notice> : null}
      {notice === "file-removed" ? <Notice>File removed.</Notice> : null}
      {notice === "install" ? <Notice>Installation saved.</Notice> : null}
      {notice === "warranty" ? <Notice>Warranty / AMC saved.</Notice> : null}
      {notice === "cancelled" ? <Notice>This job was cancelled.</Notice> : null}
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <OrderHero
        orderNumber={order.order_number}
        quoteNumber={quote?.quote_number}
        customerName={customer?.name ?? "Customer"}
        status={status}
        total={total}
        paid={paid}
        outstanding={outstanding}
        statusExplanation={statusExplanation}
      />

      <NextActionCard action={next} />

      {canReassign &&
      status !== "delivered" &&
      status !== "closed" &&
      status !== "cancelled" ? (
        <ReassignOrderForm
          orderId={order.id}
          people={listCoverSales(profiles).filter(
            (person) => person.id !== order.assigned_sales_id,
          )}
        />
      ) : null}

      {status === "order_on_hold" ? (
        <HoldCard
          outstanding={outstanding}
          orderId={order.id}
          canRecord={showRecordPayment}
        />
      ) : null}

      {payments.length > 0 ? (
        <section className={panelClass}>
          <h2 className="text-subheading text-on-surface">Payments</h2>
          <ul className="mt-3 divide-y divide-surface-variant">
            {payments.map((payment) => {
              const verifications = Array.isArray(payment.payment_verifications)
                ? payment.payment_verifications
                : payment.payment_verifications
                  ? [payment.payment_verifications]
                  : [];
              const rejectionNote =
                payment.status === "rejected"
                  ? verifications.find((row) => row.decision === "rejected")
                      ?.notes
                  : null;
              const canReview =
                payment.status === "pending" &&
                payment.recorded_by !== user.id &&
                rolesHavePermission(user.roles, "payments.verify");
              return (
              <li
                key={payment.id}
                className="flex flex-col gap-3 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium capitalize">{payment.kind}</p>
                  <p className="text-on-surface-variant">
                    {new Date(payment.created_at).toLocaleString("en-IN")}
                    {payment.method ? ` · ${payment.method}` : ""}
                    {payment.reference_number
                      ? ` · ${payment.reference_number}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">
                    {formatInrExact(Number(payment.amount))}
                  </p>
                  <p
                    className={
                      payment.status === "verified"
                        ? "text-xs font-semibold text-success"
                        : payment.status === "rejected"
                          ? "text-xs font-semibold text-destructive"
                          : "text-xs font-semibold text-on-surface-variant"
                    }
                  >
                    {payment.status === "verified"
                      ? "Verified"
                      : payment.status === "rejected"
                        ? "Rejected"
                        : "Pending verification"}
                  </p>
                </div>
                </div>
                {rejectionNote ? (
                  <p className="text-sm text-destructive">
                    Reason: {rejectionNote}
                  </p>
                ) : null}
                {canReview ? (
                  <PaymentReviewActions
                    paymentId={payment.id}
                    orderId={order.id}
                    details={`${payment.kind} · ${formatInrExact(Number(payment.amount))}`}
                  />
                ) : null}
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className={panelClass}>
        <h2 className="text-subheading text-on-surface">Items</h2>
        <ul className="mt-3 divide-y divide-surface-variant">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-w-0 justify-between gap-3 py-2.5 text-[13px]"
            >
              <span className="min-w-0 break-words">
                {item.description}
                <span className="text-on-surface-variant">
                  {" "}
                  · {item.quantity_received}/{item.quantity} received
                  {Number(item.quantity_written_off ?? 0) > 0
                    ? ` · ${item.quantity_written_off} ${item.write_off_reason ?? "closed"}`
                    : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {showRecordPayment ? (
        <section id="payment" className="scroll-mt-24">
          <PaymentForm
            quoteId={order.quote_id}
            orderId={order.id}
            remaining={outstanding}
          />
        </section>
      ) : paymentWaitingMessage ? (
        <section className="rounded-lg bg-muted px-5 py-4 text-sm text-on-surface-variant">
          {paymentWaitingMessage}
        </section>
      ) : null}

      {status === "delivery_unlocked" &&
      rolesHavePermission(user.roles, "deliveries.complete") ? (
        <section>
          <CompleteDeliveryForm orderId={order.id} />
        </section>
      ) : null}

      <AppLink
        href={`/orders/${order.id}/invoice`}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "w-full text-center",
        )}
      >
        Tax invoice
      </AppLink>

      <AttachmentPanel
        entityType="order"
        entityId={order.id}
        returnTo={`/orders/${order.id}`}
        files={files}
        canUpload={
          rolesHavePermission(user.roles, "customers.write") ||
          rolesHavePermission(user.roles, "deliveries.complete")
        }
      />

      {status === "delivery_unlocked" ||
      status === "delivered" ||
      status === "closed"
        ? canAftercare
          ? (
            <>
              <InstallationForm orderId={order.id} installation={installation} />
              <WarrantyPanel
                orderId={order.id}
                rows={warranties.map((row) => ({
                  kind: row.kind,
                  starts_on: row.starts_on,
                  ends_on: row.ends_on,
                  notes: row.notes,
                }))}
              />
            </>
          )
          : installation || warranties.length > 0
            ? (
              <section className={panelClass}>
                <h2 className="text-subheading text-on-surface">After handover</h2>
                {installation ? (
                  <p className="mt-2 text-sm">
                    Installation {installation.status}
                    {installation.scheduled_on
                      ? ` · ${new Date(installation.scheduled_on).toLocaleDateString("en-IN")}`
                      : ""}
                  </p>
                ) : null}
                {warranties.map((row) => (
                  <p key={row.id} className="mt-1 text-sm text-on-surface-variant">
                    {row.kind === "amc" ? "AMC" : "Warranty"} {row.starts_on} → {row.ends_on}
                  </p>
                ))}
              </section>
            )
            : null
        : null}

      {canCancel ? (
        <CancelJobSheet
          quoteId={order.quote_id}
          returnTo={`/orders/${order.id}`}
        />
      ) : null}

      {status === "cancelled" ? (
        <p className="rounded-lg border border-surface-variant px-4 py-6 text-center">
          <span className="block text-lg font-semibold">Job cancelled</span>
          <span className="mt-1 block text-sm text-on-surface-variant">
            {order.on_hold_reason ?? "This job will not continue."}
          </span>
        </p>
      ) : null}

      {status === "closed" || status === "delivered" ? (
        <p className="rounded-lg border border-surface-variant px-4 py-6 text-center">
          <span className="block text-lg font-semibold">Order delivered</span>
          <span className="mt-1 block text-sm text-on-surface-variant">
            This order is closed.
          </span>
        </p>
      ) : null}

      {vendorOrders[0] ? (
        <p className="text-sm text-on-surface-variant">
          Vendor: {rel(vendorOrders[0].vendors)?.name} ·{" "}
          {vendorOrders[0].status}
        </p>
      ) : null}

      {rolesHavePermission(user.roles, "fulfillment.update") ? (
        <AppLink
          href={`/fulfillment/${order.id}`}
          className="text-sm underline"
        >
          Fulfillment
        </AppLink>
      ) : null}

      {delivery ? (
        <p className="text-sm text-on-surface-variant">
          Delivered{" "}
          {new Date(delivery.delivered_at ?? "").toLocaleString("en-IN")}
        </p>
      ) : null}

      {version ? (
        <p className="text-xs text-on-surface-variant">
          Quote v{version.version_number}
        </p>
      ) : null}

      <ActivityTimeline events={activity} />
    </PageFrame>
  );
}
