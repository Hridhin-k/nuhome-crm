"use client";

import { useActionState } from "react";
import {
  completeDeliveryAction,
  type ActionState,
} from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/app/form-error";

export function CompleteDeliveryForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    completeDeliveryAction,
    {},
  );

  return (
    <FormSheet
      title="Complete delivery"
      description="Confirm handover with the customer."
      trigger={
        <span className={cn(buttonVariants({ size: "lg" }), "w-full")}>
          Complete delivery
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="notes">Delivery notes (optional)</Label>
          <Textarea id="notes" name="notes" rows={3} />
          {state.error ? (
            <FormError>
              {state.error}
            </FormError>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Confirming…" : "Confirm delivery"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
