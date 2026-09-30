"use client";

import { useActionState } from "react";
import {
  requestCreditDeliveryAction,
  decideCreditDeliveryAction,
  type ActionState,
} from "@/app/actions/workflow";
import { FormError } from "@/components/app/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CreditDeliveryRequest({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    requestCreditDeliveryAction,
    {},
  );
  return (
    <form action={action} className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-subheading">Deliver without full payment</p>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Operations must approve before handover.
      </p>
      <Textarea name="notes" rows={2} className="mt-3" placeholder="Why this job needs credit delivery" />
      <Button type="submit" variant="outline" className="mt-3 w-full" disabled={pending}>
        {pending ? "Requesting…" : "Request Operations"}
      </Button>
      {state.error ? <FormError className="mt-2">{state.error}</FormError> : null}
    </form>
  );
}

export function CreditDeliveryDecide({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    decideCreditDeliveryAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-subheading">Credit delivery request</p>
      <div className="flex gap-2">
        <Button name="decision" value="approve" type="submit" disabled={pending} className="flex-1">
          Approve
        </Button>
        <Button name="decision" value="reject" type="submit" variant="destructive" disabled={pending} className="flex-1">
          Reject
        </Button>
      </div>
      {state.error ? <FormError>{state.error}</FormError> : null}
    </form>
  );
}
