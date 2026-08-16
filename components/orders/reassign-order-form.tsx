"use client";

import { useActionState } from "react";
import {
  reassignOrderSalesAction,
  type AdminActionState,
} from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ReassignOrderForm({
  orderId,
  people,
}: {
  orderId: string;
  people: { id: string; full_name: string }[];
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    reassignOrderSalesAction,
    {},
  );

  if (people.length === 0) return null;

  return (
    <FormSheet
      title="Reassign salesperson"
      description="Moves this order and its quote to covering sales."
      triggerClassName="w-full"
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg border border-outline-variant px-6 text-[15px] font-medium">
          Reassign
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="to_user_id">Covering sales</Label>
          <select
            id="to_user_id"
            name="to_user_id"
            required
            className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </select>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Reassign"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
