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
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/app/form-error";
import { NativeSelect } from "@/components/ui/native-select";

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
        <span className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full")}>
          Reassign
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="to_user_id">Covering sales</Label>
          <NativeSelect
            id="to_user_id"
            name="to_user_id"
            required
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </NativeSelect>
          {state.error ? (
            <FormError>{state.error}</FormError>
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
