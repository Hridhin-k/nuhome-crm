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
import { PageFrame, panelClass } from "@/components/app/page-frame";
import { StatusBadge } from "@/components/app/status-badge";
import { StickyActionBar } from "@/components/app/sticky-action-bar";
import { RejectQuoteSheet } from "@/components/quotes/reject-sheet";
import { CancelJobSheet } from "@/components/quotes/cancel-sheet";
import { WhatsAppShareSheet } from "@/components/quotes/whatsapp-share-sheet";
import { AttachmentPanel } from "@/components/documents/attachment-panel";
import { listQuoteActivity } from "@/lib/api/audit";
import { listAttachments } from "@/lib/api/documents";
import { listPaymentsForOrder } from "@/lib/api/orders";
import { getQuote } from "@/lib/api/quotes";
import { publicQuotePath, publicQuoteUrl } from "@/lib/quotes/public-url";
import { getCustomerSiteUrl } from "@/lib/site-url";
import { requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { formatInr, formatInrExact } from "@/lib/format/money";
import { nextRequiredAction } from "@/lib/workflow/next-action";
import { displayWorkflowStatus, isClosedOrderStatus } from "@/lib/workflow/status-buckets";
import { canCancelJob, isCancelledStatus } from "@/lib/workflow/cancel";
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
  const canRevise = rolesHavePermission(user.roles, "quotes.revise");
  const canShareWhatsApp = rolesHavePermission(user.roles, "quotes.send_to_customer");
  const [detail, activity, siteUrl, files] = await Promise.all([
    getQuote(id),
    listQuoteActivity(id).catch(() => []),
    getCustomerSiteUrl(),
    listAttachments("quote", id).catch(() => []),
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
  const canSeeMargin = rolesHavePermission(user.roles, "quotes.read_margin");
  const canApprove = rolesHavePermission(user.roles, "quotes.approve");
  const canSend = rolesHavePermission(user.roles, "quotes.send_to_customer");
  const status = quote.status as WorkflowStatus;
  const orderStatus = order?.status as WorkflowStatus | undefined;
  const orderClosed = orderStatus ? isClosedOrderStatus(orderStatus) : false;
  const cancelled = isCancelledStatus(displayWorkflowStatus(status, orderStatus));
  const canCancel = canCancelJob({
    quoteStatus: status,
    orderStatus,
    roles: user.roles,
  });
  const displayStatus = displayWorkflowStatus(status, orderStatus);
  const next = nextRequiredAction({
    status,
    role: user.role,
    roles: user.roles,
    quoteId: quote.id,
    orderId: order?.id,
    orderStatus,
    payments,
  });
  const accountsReview = status === "quote_pending_accounts" && canApprove;
  const salesSend = status === "quote_approved" && !orderClosed && canSend;
  const canWhatsApp =
    canShareWhatsApp &&
    !orderClosed &&
    (status === "quote_approved" || status === "quote_sent_to_customer") &&
    current;
  const publicUrl = quote.public_access_token
    ? publicQuoteUrl(siteUrl, quote.public_access_token)
    : null;
  const nextForView =
    accountsReview || salesSend
      ? { ...next, href: undefined, cta: undefined }
      : next;
  const costTotal = currentItems.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unit_cost),
    0,
  );
  const marginPct = current
    ? Number(current.margin_percent) ||
      (Number(current.total) > 0
        ? (Number(current.margin_amount ?? 0) / Number(current.total)) * 100
        : 0)
    : 0;

  return (
    <PageFrame
      width="detail"
      className={cn(
        "flex flex-col gap-4",
        accountsReview && "pb-36 md:pb-0",
      )}
    >
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {accountsReview ? (
            <>
              <h1 className="truncate text-headline-lg text-on-surface">
                {quote.quote_number}
              </h1>
              <p className="mt-1 truncate text-body-md text-secondary">
                {customer?.name}
                {current ? ` v${current.version_number}` : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-body-sm text-on-surface-variant">Prepared for</p>
              <h1 className="mt-0.5 truncate text-headline-md text-on-surface">
                {customer?.name}
              </h1>
              <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">
                {quote.quote_number}
                {current ? ` · v${current.version_number}` : ""}
              </p>
            </>
          )}
        </div>
        <StatusBadge status={displayStatus} />
      </header>
      {notice === "submitted" ? <Notice>Submitted to Accounts.</Notice> : null}
      {notice === "approved" ? (
        <Notice>Quote approved. Sales can send it to the customer.</Notice>
      ) : null}
      {notice === "rejected" ? <Notice>Sent back to Sales.</Notice> : null}
      {notice === "revised" ? (
        <Notice>New version submitted to Accounts.</Notice>
      ) : null}
      {notice === "draft" ? (
        <Notice>Draft saved. Submit to Accounts when you are ready.</Notice>
      ) : null}
      {notice === "uploaded" ? <Notice>File uploaded.</Notice> : null}
      {notice === "file-removed" ? <Notice>File removed.</Notice> : null}
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <NextActionCard
        action={nextForView}
        actionSlot={
          salesSend ? (
            <ConfirmActionSheet
              title="Send to customer"
              description="This marks the quote as sent. Capture the customer’s decision next."
              triggerLabel="Send"
              confirmLabel="Send quote"
              action={sendQuoteAction.bind(null, quote.id)}
              triggerClassName="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg bg-primary px-6 text-subheading text-on-primary sm:w-auto"
            />
          ) : undefined
        }
      />

      {cancelled ? (
        <Notice>This job was cancelled.</Notice>
      ) : orderClosed ? (
        <Notice>This quote&apos;s order has been delivered and closed.</Notice>
      ) : null}

      {current?.rejection_reason ? (
        <div className="rounded-lg border border-l-[3px] border-border border-l-error bg-card px-4 py-3">
          <p className="text-[12px] font-medium text-error">
            Returned by Accounts
          </p>
          <p className="mt-1 text-sm">{current.rejection_reason}</p>
        </div>
      ) : null}

      {accountsReview && canSeeMargin && current ? (
        <section className="overflow-hidden rounded-lg border border-outline-variant bg-card">
          <div className="border-b border-outline-variant bg-surface-bright px-4 py-3">
            <h2 className="text-subheading text-on-surface">Financial Summary</h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-outline-variant">
            <div className="bg-card p-4">
              <p className="text-label-caps text-on-surface-variant">
                Total Estimate
              </p>
              <p className="mt-1 text-lg text-data-tabular">
                {formatInr(Number(current.total))}
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="text-label-caps text-on-surface-variant">Total Cost</p>
              <p className="mt-1 text-lg text-data-tabular">
                {formatInr(costTotal)}
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="text-label-caps text-on-surface-variant">Margin</p>
              <p className="mt-1 text-lg text-data-tabular">
                {formatInr(Number(current.margin_amount ?? 0))}
                <span className="ml-2 text-label-caps text-secondary">
                  ({Math.round(marginPct)}%)
                </span>
              </p>
            </div>
            <div className="bg-card p-4">
              <p className="text-label-caps text-on-surface-variant">Discount</p>
              <p className="mt-1 text-lg text-data-tabular">
                {formatInr(Number(current.discount))}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {accountsReview ? (
        <section className="overflow-hidden rounded-lg border border-outline-variant bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left">
              <thead className="border-b border-outline-variant bg-surface-container-low">
                <tr>
                  {["Item", "HSN", "Qty", "Sell", "Cost", "Disc", "Line Total"].map(
                    (col) => (
                      <th
                        key={col}
                        className={cn(
                          "p-3 text-label-caps uppercase text-secondary",
                          col !== "Item" && "text-right",
                        )}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {currentItems.map((item) => {
                  const sell = Number(item.quantity) * Number(item.unit_price);
                  const discPct =
                    sell > 0 ? (Number(item.discount) / sell) * 100 : 0;
                  return (
                    <tr key={item.id}>
                      <td className="max-w-[150px] truncate p-3 text-data-tabular">
                        {item.description}
                      </td>
                      <td className="p-3 text-right text-data-tabular text-secondary">
                        {item.hsn_code ?? "—"}
                      </td>
                      <td className="p-3 text-right text-data-tabular">
                        {item.quantity}
                      </td>
                      <td className="p-3 text-right text-data-tabular">
                        {formatInrExact(Number(item.unit_price))}
                      </td>
                      <td className="p-3 text-right text-data-tabular text-secondary">
                        {canSeeMargin
                          ? formatInrExact(Number(item.unit_cost))
                          : "—"}
                      </td>
                      <td className="p-3 text-right text-data-tabular">
                        {Number(item.discount) > 0
                          ? `${Math.round(discPct)}%`
                          : "—"}
                      </td>
                      <td className="p-3 text-right text-data-tabular font-bold">
                        {formatInrExact(Number(item.line_total))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className={panelClass}>
          <div className="flex items-center justify-between border-b border-surface-variant pb-3">
            <h2 className="text-subheading text-on-surface">Order Summary</h2>
            {current ? (
              <span className="text-body-sm text-on-surface-variant">
                v{current.version_number}
              </span>
            ) : null}
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {currentItems.map((item) => (
              <li
                key={item.id}
                className="flex min-w-0 justify-between gap-3"
              >
                <span className="min-w-0">
                  <span className="block text-body-md text-on-surface">
                    {item.description}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    Qty {item.quantity}
                    {item.hsn_code ? ` · HSN ${item.hsn_code}` : ""}
                    {Number(item.gst_rate) > 0
                      ? ` · GST ${item.gst_rate}%`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 text-data-tabular">
                  {formatInrExact(Number(item.line_total))}
                </span>
              </li>
            ))}
          </ul>
          {current ? (
            <div className="mt-4 flex items-center justify-between border-t border-surface-variant pt-3">
              <span className="text-subheading">Total Estimate</span>
              <span className="text-headline-md font-bold tabular-nums text-primary">
                {formatInrExact(Number(current.total))}
              </span>
            </div>
          ) : null}
        </section>
      )}

      {accountsReview && current?.notes ? (
        <section className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
          <h3 className="text-label-caps uppercase text-secondary">
            Notes from Sales
          </h3>
          <p className="mt-2 text-body-md text-on-surface">{current.notes}</p>
        </section>
      ) : current?.notes && !accountsReview ? (
        <p className="text-sm text-on-surface-variant">{current.notes}</p>
      ) : null}

      <AttachmentPanel
        entityType="quote"
        entityId={quote.id}
        returnTo={`/quotes/${quote.id}`}
        files={files}
        canUpload={rolesHavePermission(user.roles, "quotes.create")}
      />

      {order ? (
        <AppLink
          href={`/orders/${order.id}/invoice`}
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full text-center")}
        >
          Tax invoice
        </AppLink>
      ) : null}

      {salesSend ? (
        <div className="flex flex-col gap-2 sm:flex-row">
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
                "w-full text-center sm:flex-1",
              )}
            >
              View public link
            </AppLink>
          ) : null}
          {canRevise ? (
            <AppLink
              href={`/quotes/${quote.id}/revise`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full text-center sm:flex-1",
              )}
            >
              Correct before send
            </AppLink>
          ) : null}
        </div>
      ) : null}

      {!accountsReview && !salesSend ? (
        <div className="flex flex-col gap-3">
          {status === "quote_draft" && canRevise ? (
            <AppLink
              href={`/quotes/${quote.id}/revise`}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full text-center",
              )}
            >
              Edit draft
            </AppLink>
          ) : null}
          {status === "quote_draft" &&
          rolesHavePermission(user.roles, "quotes.submit") ? (
            <ConfirmActionSheet
              title="Submit to Accounts"
              description="The customer will not see this quote until it is approved and sent."
              triggerLabel="Submit to Accounts"
              confirmLabel="Submit quote"
              action={submitQuoteAction.bind(null, quote.id)}
            />
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
                buttonVariants({
                  variant: orderClosed ? "outline" : "default",
                  size: "lg",
                }),
                "w-full text-center",
              )}
            >
              {orderClosed ? "View closed order" : "Open order"}
            </AppLink>
          ) : null}
        </div>
      ) : order && !salesSend ? (
        <AppLink
          href={`/orders/${order.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full text-center",
          )}
        >
          Open order
        </AppLink>
      ) : null}

      {canCancel ? (
        <CancelJobSheet
          quoteId={quote.id}
          returnTo={`/quotes/${quote.id}`}
        />
      ) : null}

      {!accountsReview && versions.length > 1 ? (
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
                    isCurrent ? "border-primary" : "border-border",
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <p className="min-w-0 font-medium">
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
                              <span className="text-on-surface-variant">
                                {" "}
                                × {item.quantity}
                              </span>
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
      ) : null}

      <ActivityTimeline events={activity} />

      {accountsReview ? (
        <StickyActionBar>
          <div className="flex-1">
            <RejectQuoteSheet quoteId={quote.id} />
          </div>
          <div className="flex-[2]">
            <ConfirmActionSheet
              title="Approve quote"
              description="Sales can then send this version to the customer."
              triggerLabel="Approve"
              confirmLabel="Approve"
              action={approveQuoteAction.bind(null, quote.id)}
            />
          </div>
        </StickyActionBar>
      ) : null}
    </PageFrame>
  );
}
