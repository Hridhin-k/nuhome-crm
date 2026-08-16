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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
        <span className="inline-flex h-11 min-h-11 items-center rounded-lg border border-outline-variant px-6 text-[15px] font-medium">
          Cover for leave
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="from_user_id">Away</Label>
          <select
            id="from_user_id"
            name="from_user_id"
            required
            className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3"
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.full_name}
              </option>
            ))}
          </select>
          <Label htmlFor="to_user_id">Covering</Label>
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
