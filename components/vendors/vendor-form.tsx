"use client";

import { useActionState } from "react";
import { createVendorAdminAction, type AdminActionState } from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function VendorForm({
  triggerClassName = "w-auto",
}: {
  triggerClassName?: string;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    createVendorAdminAction,
    {},
  );
  return (
    <FormSheet
      title="Add vendor"
      description="Used when sending an activated order."
      triggerClassName={triggerClassName}
      trigger={
        <span className="inline-flex h-11 min-h-11 items-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary">
          Add vendor
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required className="h-11 min-h-11" />
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" className="h-11 min-h-11" />
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" className="h-11 min-h-11" />
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} />
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Save vendor"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
