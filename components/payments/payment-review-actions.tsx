import { verifyPaymentAction } from "@/app/actions/workflow";
import { ConfirmActionSheet } from "@/components/app/confirm-action-sheet";
import { RejectPaymentSheet } from "@/components/payments/reject-sheet";

export function PaymentReviewActions({
  paymentId,
  orderId,
  details,
}: {
  paymentId: string;
  orderId?: string;
  details?: string;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        <RejectPaymentSheet paymentId={paymentId} orderId={orderId} />
      </div>
      <div className="flex-1">
        <ConfirmActionSheet
          title="Verify payment"
          description="Only verify what you have confirmed. You cannot verify a payment you recorded."
          details={details}
          triggerLabel="Verify"
          confirmLabel="Verify"
          action={verifyPaymentAction.bind(null, paymentId, orderId)}
        />
      </div>
    </div>
  );
}
