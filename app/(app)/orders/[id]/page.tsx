import { AppLink } from "@/components/app/app-link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { Notice } from "@/components/app/notice";
import { NextActionCard } from "@/components/app/next-action-card";
import { WorkflowStepper } from "@/components/app/workflow-stepper";
import { CompleteDeliveryForm } from "@/components/deliveries/complete-form";
import { HoldCard } from "@/components/orders/hold-card";
import { OrderHero } from "@/components/orders/order-hero";
import { OrderTimeline } from "@/components/orders/timeline";
import { PaymentForm } from "@/components/payments/payment-form";
import { listOrderActivity } from "@/lib/api/audit";
import { getOrder } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatInrExact } from "@/lib/format/money";
import { nextRequiredAction } from "@/lib/workflow/next-action";
import { orderStatusExplanation } from "@/lib/workflow/status-explanation";
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
  const [detail, activity] = await Promise.all([
    getOrder(id),
    listOrderActivity(id).catch(() => []),
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
    outstanding,
    orderId: order.id,
    quoteId: order.quote_id,
    activated: Boolean(order.activated_at),
  });
  const version = rel(quote?.quote_versions);
  const statusExplanation = orderStatusExplanation({
    status,
    outstanding,
    activated: Boolean(order.activated_at),
  });

  return (
    <div className="flex flex-col gap-6">
      {notice === "delivered" ? (
        <Notice>Order delivered. This job is now closed.</Notice>
      ) : null}
      {notice === "payment" ? (
        <Notice>Payment recorded. Waiting for Accounts to verify.</Notice>
      ) : null}
      {notice === "verified" ? <Notice>Payment verified.</Notice> : null}
      {notice === "received" ? (
        <Notice>Items received. Delivery gate applied.</Notice>
      ) : null}
      {notice === "sent" ? (
        <Notice>Approved quote sent. Record payment terms next.</Notice>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <OrderHero
        quoteNumber={quote?.quote_number ?? "Order"}
        customerName={customer?.name ?? "Customer"}
        status={status}
        total={total}
        paid={paid}
        outstanding={outstanding}
        statusExplanation={statusExplanation}
      />

      <NextActionCard action={next} />

      <WorkflowStepper status={status} outstanding={outstanding} />

      {status === "order_on_hold" ? (
        <HoldCard
          outstanding={outstanding}
          orderId={order.id}
          canRecord={roleHasPermission(user.role, "payments.record")}
        />
      ) : null}

      <OrderTimeline
        status={status}
        activated={Boolean(order.activated_at)}
      />

      {payments.length > 0 ? (
        <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
          <h2 className="text-headline-sm text-on-surface">Payments</h2>
          <ul className="mt-3 divide-y divide-surface-variant">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium capitalize">{payment.kind}</p>
                  <p className="text-on-surface-variant">
                    {new Date(payment.created_at).toLocaleString("en-IN")}
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
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
        <h2 className="text-headline-sm text-on-surface">Items</h2>
        <ul className="mt-3 divide-y divide-surface-variant">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex justify-between py-3 text-sm"
            >
              <span>
                {item.description}
                <span className="text-on-surface-variant">
                  {" "}
                  · {item.quantity_received}/{item.quantity} received
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {roleHasPermission(user.role, "payments.record") &&
      !["delivered", "closed"].includes(status) ? (
        <section id="payment" className="scroll-mt-24">
          <PaymentForm
            quoteId={order.quote_id}
            orderId={order.id}
            remaining={outstanding}
          />
        </section>
      ) : null}

      {status === "delivery_unlocked" &&
      roleHasPermission(user.role, "deliveries.complete") ? (
        <section>
          <CompleteDeliveryForm orderId={order.id} />
        </section>
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

      {roleHasPermission(user.role, "orders.send_to_vendor") ? (
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
    </div>
  );
}
