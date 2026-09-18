"use client";

import { useActionState } from "react";
import { rejectQuoteAction, type ActionState } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function RejectQuoteSheet({
  quoteId,
  triggerLabel = "Return",
  triggerClassName,
}: {
  quoteId: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    rejectQuoteAction,
    {},
  );

  return (
    <FormSheet
      title="Send back to Sales"
      description="A reason is required. The customer will not see this quote."
      trigger={
        <span
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full justify-center text-center border-error text-error hover:bg-error/5",
            triggerClassName,
          )}
        >
          {triggerLabel}
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="quote_id" value={quoteId} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="reason">Rejection reason</Label>
          <Textarea
            id="reason"
            name="reason"
            required
            rows={4}
            className="min-h-28"
          />
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="submit"
            disabled={pending}
            size="lg"
            className="w-full justify-center text-center"
          >
            {pending ? "Sending…" : "Send back to Sales"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
