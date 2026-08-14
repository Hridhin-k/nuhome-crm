import { AppLink } from "@/components/app/app-link";
import { notFound } from "next/navigation";
import {
  approveQuoteAction,
  sendQuoteAction,
  submitQuoteAction,
} from "@/app/actions/workflow";
import { ActivityTimeline } from "@/components/app/activity-timeline";
import { ConfirmActionSheet } from "@/components/app/confirm-action-sheet";
import { NextActionCard } from "@/components/app/next-action-card";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { WorkflowStepper } from "@/components/app/workflow-stepper";
import { RejectQuoteSheet } from "@/components/quotes/reject-sheet";
import { WhatsAppShareSheet } from "@/components/quotes/whatsapp-share-sheet";
import { listQuoteActivity } from "@/lib/api/audit";
import { listPaymentsForOrder } from "@/lib/api/orders";
import { getQuote } from "@/lib/api/quotes";
import { publicQuotePath, publicQuoteUrl } from "@/lib/quotes/public-url";
import { getCustomerSiteUrl } from "@/lib/site-url";
import { requireUser } from "@/lib/auth/guards";
import { roleHasPermission } from "@/lib/auth/permissions";
import { formatInrExact } from "@/lib/format/money";
import { nextRequiredAction } from "@/lib/workflow/next-action";
import { displayWorkflowStatus, isClosedOrderStatus } from "@/lib/workflow/status-buckets";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { WorkflowStatus } from "@/lib/workflow/types";

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { notice, error } = await searchParams;
  const canRevise = roleHasPermission(user.role, "quotes.revise");
  const canShareWhatsApp = roleHasPermission(user.role, "quotes.send_to_customer");
  const [detail, activity, siteUrl] = await Promise.all([
    getQuote(id),
    listQuoteActivity(id).catch(() => []),
    getCustomerSiteUrl(),
  ]);
  if (!detail) {
    notFound();
  }

  const { quote, customer, versions, items, order } = detail;
  const payments = order?.id
    ? await listPaymentsForOrder(order.id).catch(() => [])
    : [];
  const current =
    versions.find((v) => v.id === quote.current_version_id) ?? versions[0];
  const currentItems = items.filter((i) => i.version_id === current?.id);
  const canSeeMargin = roleHasPermission(user.role, "quotes.read_margin");
  const status = quote.status as WorkflowStatus;
  const orderStatus = order?.status as WorkflowStatus | undefined;
  const orderClosed = orderStatus ? isClosedOrderStatus(orderStatus) : false;
  const displayStatus = displayWorkflowStatus(status, orderStatus);
  const next = nextRequiredAction({
    status,
    role: user.role,
    quoteId: quote.id,
    orderId: order?.id,
    orderStatus,
    payments,
  });
  const canWhatsApp =
    canShareWhatsApp &&
    !orderClosed &&
    (status === "quote_approved" || status === "quote_sent_to_customer") &&
    current;
  const publicUrl = quote.public_access_token
    ? publicQuoteUrl(siteUrl, quote.public_access_token)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={quote.quote_number} description={customer?.name} />
      {notice === "submitted" ? <Notice>Submitted to Accounts.</Notice> : null}
      {notice === "approved" ? (
        <Notice>Quote approved. Sales can send it to the customer.</Notice>
      ) : null}
      {notice === "rejected" ? <Notice>Sent back to Sales.</Notice> : null}
      {notice === "revised" ? (
        <Notice>New version submitted to Accounts.</Notice>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <WorkflowStepper status={displayStatus} />

      <NextActionCard action={next} />

      {orderClosed ? (
        <Notice>This quote&apos;s order has been delivered and closed.</Notice>
      ) : null}

      <div className="flex items-center justify-between">
        <StatusBadge status={displayStatus} />
        {current ? (
          <p className="text-sm text-on-surface-variant">Version {current.version_number}</p>
        ) : null}
      </div>

      {current?.rejection_reason ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Returned by Accounts
          </p>
          <p className="mt-1 text-sm">{current.rejection_reason}</p>
        </div>
      ) : null}

      <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
        <h2 className="text-sm font-semibold">Items</h2>
        <ul className="mt-3 divide-y divide-surface-variant">
          {currentItems.map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-3 py-2 text-sm"
            >
              <span>
                {item.description}
                <span className="text-on-surface-variant"> × {item.quantity}</span>
              </span>
              <span>{formatInrExact(Number(item.line_total))}</span>
            </li>
          ))}
        </ul>
        {current ? (
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Subtotal</dt>
              <dd>{formatInrExact(Number(current.subtotal))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Discount</dt>
              <dd>{formatInrExact(Number(current.discount))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Tax</dt>
              <dd>{formatInrExact(Number(current.tax))}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{formatInrExact(Number(current.total))}</dd>
            </div>
            {canSeeMargin ? (
              <div className="flex justify-between text-on-surface-variant">
                <dt>Margin</dt>
                <dd>{formatInrExact(Number(current.margin_amount ?? 0))}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        {current?.notes ? (
          <p className="mt-3 text-sm text-on-surface-variant">{current.notes}</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">History</h2>
        <ol className="flex flex-col gap-2">
          {versions.map((version) => {
            const isCurrent = version.id === quote.current_version_id;
            const versionItems = items.filter(
              (i) => i.version_id === version.id,
            );
            return (
              <li
                key={version.id}
                className={cn(
                  "rounded-lg border px-4 py-3",
                  isCurrent ? "border-foreground" : "border-surface-variant",
                )}
              >
                <div className="flex justify-between gap-3">
                  <p className="font-medium">
                    Version {version.version_number}
                    {isCurrent ? " · current" : ""}
                  </p>
                  <StatusBadge status={version.status as WorkflowStatus} />
                </div>
                {version.rejection_reason ? (
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {version.rejection_reason}
                  </p>
                ) : null}
                {!isCurrent && versionItems.length > 0 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-on-surface-variant">
                      View items · {formatInrExact(Number(version.total))}
                    </summary>
                    <ul className="mt-2 divide-y divide-surface-variant">
                      {versionItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between gap-3 py-1.5 text-sm"
                        >
                          <span>
                            {item.description}
                            <span className="text-on-surface-variant"> × {item.quantity}</span>
                          </span>
                          <span>{formatInrExact(Number(item.line_total))}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-col gap-3">
        {status === "quote_draft" &&
        roleHasPermission(user.role, "quotes.submit") ? (
          <ConfirmActionSheet
            title="Submit to Accounts"
            description="The customer will not see this quote until it is approved and sent."
            triggerLabel="Submit to Accounts"
            confirmLabel="Submit quote"
            action={submitQuoteAction.bind(null, quote.id)}
          />
        ) : null}
        {status === "quote_pending_accounts" &&
        roleHasPermission(user.role, "quotes.approve") ? (
          <>
            <ConfirmActionSheet
              title="Approve quote"
              description="Sales can then send this version to the customer."
              triggerLabel="Approve quote"
              confirmLabel="Approve"
              action={approveQuoteAction.bind(null, quote.id)}
            />
            <RejectQuoteSheet quoteId={quote.id} />
          </>
        ) : null}
        {status === "quote_approved" &&
        !orderClosed &&
        roleHasPermission(user.role, "quotes.send_to_customer") ? (
          <>
            <ConfirmActionSheet
              title="Send to customer"
              description="This marks the quote as sent. Capture the customer’s decision next."
              triggerLabel="Send to customer"
              confirmLabel="Send quote"
              action={sendQuoteAction.bind(null, quote.id)}
            />
            {canWhatsApp && current && publicUrl ? (
              <WhatsAppShareSheet
                quoteId={quote.id}
                customerName={customer?.name ?? "Customer"}
                customerPhone={customer?.phone}
                quoteNumber={quote.quote_number}
                versionNumber={current.version_number}
                total={Number(current.total)}
                quoteUrl={publicUrl}
              />
            ) : null}
            {publicUrl ? (
            <AppLink
              href={publicQuotePath(quote.public_access_token!)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full text-center",
              )}
            >
              View customer quotation
            </AppLink>
            ) : null}
          </>
        ) : null}
        {status === "quote_sent_to_customer" &&
        !orderClosed &&
        canWhatsApp &&
        current &&
        publicUrl ? (
          <WhatsAppShareSheet
            quoteId={quote.id}
            customerName={customer?.name ?? "Customer"}
            customerPhone={customer?.phone}
            quoteNumber={quote.quote_number}
            versionNumber={current.version_number}
            total={Number(current.total)}
            quoteUrl={publicUrl}
          />
        ) : null}
        {status === "quote_rejected" && canRevise ? (
          <AppLink
            href={`/quotes/${quote.id}/revise`}
            className={cn(buttonVariants({ size: "lg" }), "w-full text-center")}
          >
            Revise quote
          </AppLink>
        ) : null}
        {order ? (
          <AppLink
            href={`/orders/${order.id}`}
            className={cn(
              buttonVariants({ variant: orderClosed ? "outline" : "default", size: "lg" }),
              "w-full text-center",
            )}
          >
            {orderClosed ? "View closed order" : "Open order"}
          </AppLink>
        ) : null}
      </div>

      <ActivityTimeline events={activity} />
    </div>
  );
}
