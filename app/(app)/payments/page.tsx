import { PaymentReviewActions } from "@/components/payments/payment-review-actions";
import { EmptyState } from "@/components/app/empty-state";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { listPendingPayments } from "@/lib/api/catalog";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";

function kindLabel(kind: string) {
  if (kind === "advance") return "Advance";
  if (kind === "full") return "Full";
  if (kind === "nil") return "Nil";
  return kind;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [, { notice, error }, payments] = await Promise.all([
    requirePermission("payments.verify"),
    searchParams,
    listPendingPayments(),
  ]);

  return (
    <PageFrame width="detail">
      <PageHeader
        title="Payments"
        description="Verify a payment, or send a wrong entry back to Sales with a reason."
      />
      {notice === "verified" ? <Notice>Payment verified.</Notice> : null}
      {notice === "payment-rejected" ? (
        <Notice>Payment sent back to Sales.</Notice>
      ) : null}
      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {payments.length === 0 ? (
        <EmptyState
          title="No payments waiting"
          description="When Sales logs a payment, it appears here for verification."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {payments.map((payment) => {
            const quote = rel(payment.quotes);
            const customer = rel(quote?.customers);
            const order = rel(payment.orders);
            const details = [
              kindLabel(payment.kind),
              formatInr(Number(payment.amount)),
              payment.method,
              payment.reference_number,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={payment.id}
                className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-card p-4 shadow-card md:flex-row md:items-center md:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-subheading text-on-surface">
                      {order?.order_number ??
                        customer?.name ??
                        quote?.quote_number}
                    </p>
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-caps text-on-secondary-container">
                      {kindLabel(payment.kind)}
                    </span>
                  </div>
                  <p className="mt-1 text-headline-md text-primary">
                    {formatInr(Number(payment.amount))}
                  </p>
                  <p className="mt-1 text-data-tabular text-on-surface-variant">
                    {[
                      customer?.name,
                      quote?.quote_number,
                      payment.method,
                      payment.reference_number,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "No method recorded"}
                  </p>
                </div>
                <div className="w-full md:w-auto md:min-w-[240px]">
                  <PaymentReviewActions
                    paymentId={payment.id}
                    orderId={payment.order_id ?? undefined}
                    details={details}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageFrame>
  );
}
