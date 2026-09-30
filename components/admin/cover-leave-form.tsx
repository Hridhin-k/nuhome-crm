"use client";

import { useActionState } from "react";
import {
  reassignSalesCoverAction,
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

export function CoverLeaveForm({
  people,
}: {
  people: { id: string; full_name: string }[];
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    reassignSalesCoverAction,
    {},
  );

  return (
    <FormSheet
      title="Cover for leave"
      description="Move this salesperson's open customers, quotes, and orders to covering sales."
      trigger={
        <span className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Cover for leave
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="from_user_id">Away</Label>
          <NativeSelect
            id="from_user_id"
            name="from_user_id"
            required
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </NativeSelect>
          <Label htmlFor="to_user_id">Covering</Label>
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
          {state.notice ? (
            <p className="text-sm text-on-surface">{state.notice}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Moving…" : "Reassign open work"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
