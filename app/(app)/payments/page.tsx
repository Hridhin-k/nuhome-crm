import { verifyPaymentAction } from "@/app/actions/workflow";
import { ConfirmActionSheet } from "@/components/app/confirm-action-sheet";
import { EmptyState } from "@/components/app/empty-state";
import { Notice } from "@/components/app/notice";
import { PageHeader } from "@/components/app/page-header";
import { listPendingPayments } from "@/lib/api/catalog";
import { rel } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { formatInr } from "@/lib/format/money";

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
    <div>
      <PageHeader
        title="Payments"
        description="Verify advance, full, or nil payments recorded by Sales."
      />
      {notice === "verified" ? <Notice>Payment verified.</Notice> : null}
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
            return (
              <li
                key={payment.id}
                className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card"
              >
                <p className="font-medium">
                  {customer?.name ?? quote?.quote_number}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {payment.kind} · {formatInr(Number(payment.amount))}
                </p>
                <div className="mt-3">
                  <ConfirmActionSheet
                    title="Verify payment"
                    description="Only verify what you have confirmed. You cannot verify your own entry."
                    details={`${payment.kind} · ${formatInr(Number(payment.amount))}`}
                    triggerLabel="Verify payment"
                    confirmLabel="Verify"
                    action={verifyPaymentAction.bind(
                      null,
                      payment.id,
                      payment.order_id ?? undefined,
                    )}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
