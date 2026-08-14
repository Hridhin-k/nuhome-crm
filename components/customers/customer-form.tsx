"use client";

import { useActionState } from "react";
import { createCustomerAction, type ActionState } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function CustomerForm({
  trigger,
  defaultOpen = false,
  triggerClassName = "w-auto",
  returnTo,
}: {
  trigger?: ReactNode;
  defaultOpen?: boolean;
  triggerClassName?: string;
  returnTo?: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCustomerAction,
    {},
  );

  return (
    <FormSheet
      title="New customer"
      description="Name and phone are enough on the floor."
      defaultOpen={defaultOpen}
      triggerClassName={triggerClassName}
      trigger={
        trigger ?? (
          <span
            className={cn(
              "inline-flex h-11 min-h-11 items-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary",
            )}
          >
            Add
          </span>
        )
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <FormSheetBody className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" rows={2} className="mt-2" />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Save"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
