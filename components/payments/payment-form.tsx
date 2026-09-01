"use client";

import { useActionState, useState } from "react";
import { recordPaymentAction, type ActionState } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function PaymentForm({
  quoteId,
  orderId,
  remaining,
}: {
  quoteId: string;
  orderId: string;
  remaining: number;
}) {
  const [kind, setKind] = useState<"advance" | "full" | "nil">("advance");
  const [amount, setAmount] = useState(String(remaining));
  const [state, action, pending] = useActionState<ActionState, FormData>(
    recordPaymentAction,
    {},
  );
  const amountLocked = kind === "full" || kind === "nil";
  const displayAmount = kind === "nil" ? "0" : kind === "full" ? String(remaining) : amount;

  return (
    <FormSheet
      title="Record payment"
      description="Accounts will verify this before it counts toward delivery. You can log another installment while the job is with the vendor. Delivery can log cash or UPI at handover."
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-subheading text-on-primary">
          Record payment
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="quote_id" value={quoteId} />
        <input type="hidden" name="order_id" value={orderId} />
        <FormSheetBody className="flex flex-col gap-4">
          <div>
            <Label htmlFor="kind">Payment type</Label>
            <select
              id="kind"
              name="kind"
              value={kind}
              onChange={(e) => {
                const next = e.target.value as typeof kind;
                setKind(next);
                if (next === "full") setAmount(String(remaining));
                if (next === "nil") setAmount("0");
              }}
              className="mt-2 h-11 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
            >
              <option value="advance">Advance</option>
              <option value="full">Full</option>
              <option value="nil">Nil (credit terms)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              readOnly={amountLocked}
              value={displayAmount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(
                "mt-2 h-11 min-h-11",
                amountLocked && "cursor-not-allowed bg-surface-container-low",
              )}
              aria-readonly={amountLocked}
            />
          </div>
          <div>
            <Label htmlFor="method">Method</Label>
            <select
              id="method"
              name="method"
              className="mt-2 h-11 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
            >
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              name="reference"
              className="mt-2 h-11 min-h-11"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
