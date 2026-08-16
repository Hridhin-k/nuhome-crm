"use client";

import { useActionState } from "react";
import { cancelJobAction, type ActionState } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function CancelJobSheet({
  quoteId,
  returnTo,
  triggerLabel = "Cancel job",
}: {
  quoteId: string;
  returnTo: string;
  triggerLabel?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    cancelJobAction,
    {},
  );

  return (
    <FormSheet
      title="Cancel this job"
      description="Use this when the quote or order will never complete. A reason is required."
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg border border-error bg-surface-container-lowest px-4 text-subheading text-error">
          {triggerLabel}
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="quote_id" value={quoteId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
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
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Cancelling…" : "Cancel job"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
