"use client";

import { useActionState } from "react";
import { rejectPaymentAction, type ActionState } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function RejectPaymentSheet({
  paymentId,
  orderId,
}: {
  paymentId: string;
  orderId?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    rejectPaymentAction,
    {},
  );

  return (
    <FormSheet
      title="Send back to Sales"
      description="A reason is required. Sales can then record a corrected payment."
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg border border-primary bg-surface-container-lowest px-4 text-subheading text-primary">
          Return
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="payment_id" value={paymentId} />
        {orderId ? <input type="hidden" name="order_id" value={orderId} /> : null}
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor={`payment-reason-${paymentId}`}>Rejection reason</Label>
          <Textarea
            id={`payment-reason-${paymentId}`}
            name="reason"
            required
            rows={4}
            className="min-h-28"
            placeholder="Wrong UPI amount, missing reference, …"
          />
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Sending…" : "Send back to Sales"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
