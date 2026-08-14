import { AppLink } from "@/components/app/app-link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/app/notice";
import { NextActionCard } from "@/components/app/next-action-card";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { WorkflowStepper } from "@/components/app/workflow-stepper";
import { CompleteDeliveryForm } from "@/components/deliveries/complete-form";
import { HoldCard } from "@/components/orders/hold-card";
import { OrderTimeline } from "@/components/orders/timeline";
import { PaymentForm } from "@/components/payments/payment-form";
import { getOrder } from "@/lib/api/orders";
import { rel } from "@/lib/api/rel";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatInr, formatInrExact } from "@/lib/format/money";
import { nextRequiredAction } from "@/lib/workflow/next-action";
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
  const detail = await getOrder(id);
  if (!detail) {
    notFound();
  }

  const { order, customer, quote, items, vendorOrders, delivery, balance } =
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={quote?.quote_number ?? "Order"}
        description={customer?.name}
      />
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

      <WorkflowStepper status={status} outstanding={outstanding} />

      <NextActionCard action={next} />

      {status === "order_on_hold" ? (
        <HoldCard
          outstanding={outstanding}
          orderId={order.id}
          canRecord={roleHasPermission(user.role, "payments.record")}
        />
      ) : null}

      <StatusBadge status={status} />

      {(status === "items_received" ||
        status === "delivery_pending_payment" ||
        status === "order_on_hold" ||
        status === "delivery_unlocked") && (
        <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
          <p className="text-label text-on-surface-variant">Financial summary</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Order total</dt>
              <dd className="font-semibold text-on-surface">
                {formatInrExact(total)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Paid</dt>
              <dd className="font-semibold text-on-surface">
                {formatInrExact(paid)}
              </dd>
            </div>
            <div
              className={
                outstanding > 0
                  ? "flex justify-between rounded-lg bg-error/10 px-3 py-2 font-semibold text-error"
                  : "flex justify-between font-semibold text-success"
              }
            >
              <dt>Outstanding balance</dt>
              <dd>{formatInrExact(outstanding)}</dd>
            </div>
          </dl>
          {outstanding > 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">
              Delivery locked · {formatInr(outstanding)} remaining
            </p>
          ) : (
            <p className="mt-3 text-sm font-medium text-success">
              Delivery ready
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
        <OrderTimeline
          status={status}
          activated={Boolean(order.activated_at)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Items</h2>
        <ul className="divide-y divide-surface-variant rounded-lg border border-surface-variant">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex justify-between px-4 py-3 text-sm"
            >
              <span>
                {item.description}
                <span className="text-on-surface-variant">
                  {" "}
                  · {item.quantity_received}/{item.quantity}
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
          <p className="mb-3 text-sm text-on-surface-variant">
            {customer?.name} · {quote?.quote_number} · paid {formatInr(paid)}
          </p>
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
        <p className="text-xs text-on-surface-variant">Quote v{version.version_number}</p>
      ) : null}
    </div>
  );
}
