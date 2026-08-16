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
  customer,
}: {
  trigger?: ReactNode;
  defaultOpen?: boolean;
  triggerClassName?: string;
  returnTo?: string;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    gstin?: string | null;
    billing_address?: string | null;
    site_address?: string | null;
    notes: string | null;
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCustomerAction,
    {},
  );
  const editing = Boolean(customer);

  return (
    <FormSheet
      title={editing ? "Edit customer" : "New customer"}
      description={
        editing
          ? "Update the profile. Phone numbers cannot match another customer."
          : "Name and phone are enough on the floor. Phone must be unique."
      }
      defaultOpen={defaultOpen}
      triggerClassName={triggerClassName}
      trigger={
        trigger ?? (
          <span
            className={cn(
              "inline-flex h-9 min-h-9 items-center rounded-lg bg-primary px-3 text-subheading text-on-primary",
            )}
          >
            {editing ? "Edit" : "Add"}
          </span>
        )
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        {customer ? (
          <input type="hidden" name="customer_id" value={customer.id} />
        ) : null}
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <FormSheetBody className="flex flex-col gap-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={customer?.name}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={customer?.phone ?? ""}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={customer?.email ?? ""}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="gstin">GSTIN</Label>
            <Input
              id="gstin"
              name="gstin"
              maxLength={15}
              defaultValue={customer?.gstin ?? ""}
              className="mt-2 h-11 min-h-11 uppercase"
            />
          </div>
          <div>
            <Label htmlFor="billing_address">Billing address</Label>
            <Textarea
              id="billing_address"
              name="billing_address"
              rows={2}
              defaultValue={customer?.billing_address ?? customer?.address ?? ""}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="site_address">Site address</Label>
            <Textarea
              id="site_address"
              name="site_address"
              rows={2}
              defaultValue={customer?.site_address ?? ""}
              className="mt-2"
              placeholder="Leave blank if same as billing"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={customer?.notes ?? ""}
              className="mt-2"
            />
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
