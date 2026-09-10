"use client";

import { useActionState } from "react";
import {
  requestCreditDeliveryAction,
  decideCreditDeliveryAction,
  type ActionState,
} from "@/app/actions/workflow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CreditDeliveryRequest({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    requestCreditDeliveryAction,
    {},
  );
  return (
    <form action={action} className="rounded-lg border border-outline-variant bg-card p-4">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-subheading">Deliver without full payment</p>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Super Accounts must approve before handover.
      </p>
      <Textarea name="notes" rows={2} className="mt-3" placeholder="Why this job needs credit delivery" />
      <Button type="submit" className="mt-3 w-full min-h-11" disabled={pending}>
        {pending ? "Requesting…" : "Request Super Accounts"}
      </Button>
      {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

export function CreditDeliveryDecide({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    decideCreditDeliveryAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-outline-variant p-4">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-subheading">Credit delivery request</p>
      <div className="flex gap-2">
        <Button name="decision" value="approve" type="submit" disabled={pending} className="flex-1 min-h-11">
          Approve
        </Button>
        <Button name="decision" value="reject" type="submit" variant="outline" disabled={pending} className="flex-1 min-h-11">
          Reject
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
