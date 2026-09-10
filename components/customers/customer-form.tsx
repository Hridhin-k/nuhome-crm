"use client";

import { useActionState, useState } from "react";
import { createCustomerAction, type ActionState } from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocalMobileInput } from "@/components/ui/local-mobile-input";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeLocalMobileInput } from "@/lib/customers/phone";
import {
  FOLLOW_UP_ACTIONS,
  HEAR_SOURCES,
  INTERESTS,
  PROFESSIONS,
  PROJECT_STATUSES,
  PROPERTY_TYPES,
} from "@/lib/customers/walk-in";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type CustomerFormValue = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin?: string | null;
  billing_address?: string | null;
  site_address?: string | null;
  notes: string | null;
  firm?: string | null;
  whatsapp?: string | null;
  profession?: string[] | null;
  profession_other?: string | null;
  property_type?: string | null;
  property_other?: string | null;
  project_status?: string | null;
  interests?: string[] | null;
  source?: string | null;
  source_other?: string | null;
  follow_up_on?: string | null;
  follow_up_action?: string | null;
};

function CheckRow({
  name,
  value,
  defaultChecked,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="size-5 accent-primary"
      />
      <span>{value}</span>
    </label>
  );
}

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
  customer?: CustomerFormValue;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCustomerAction,
    {},
  );
  const [phone, setPhone] = useState(
    sanitizeLocalMobileInput(customer?.phone ?? ""),
  );
  const [whatsapp, setWhatsapp] = useState(
    sanitizeLocalMobileInput(customer?.whatsapp ?? ""),
  );
  const editing = Boolean(customer);
  const professions = customer?.profession ?? [];
  const interests = customer?.interests ?? [];

  return (
    <FormSheet
      title={editing ? "Edit walk-in" : "Daily walk-in"}
      description="Name and phone are enough to start. Capture firm, profession, and follow-up when you have them."
      defaultOpen={defaultOpen}
      triggerClassName={triggerClassName}
      trigger={
        trigger ?? (
          <span
            className={cn(
              "inline-flex h-11 min-h-11 items-center rounded-lg bg-primary px-3 text-subheading text-on-primary",
            )}
          >
            {editing ? "Edit" : "Add walk-in"}
          </span>
        )
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        {customer ? (
          <input type="hidden" name="customer_id" value={customer.id} />
        ) : null}
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <FormSheetBody className="flex flex-col gap-5 pb-4">
          <fieldset className="flex flex-col gap-4">
            <legend className="text-label-caps text-secondary">Customer</legend>
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
              <Label htmlFor="firm">Firm name</Label>
              <Input
                id="firm"
                name="firm"
                defaultValue={customer?.firm ?? ""}
                className="mt-2 h-11 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <LocalMobileInput
                id="phone"
                name="phone"
                value={phone}
                onChange={setPhone}
                className="mt-2 h-11 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <LocalMobileInput
                id="whatsapp"
                name="whatsapp"
                value={whatsapp}
                onChange={setWhatsapp}
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
              <Label htmlFor="billing_address">Address</Label>
              <Textarea
                id="billing_address"
                name="billing_address"
                rows={2}
                defaultValue={customer?.billing_address ?? customer?.address ?? ""}
                className="mt-2 min-h-20"
              />
            </div>
            <div>
              <Label htmlFor="site_address">Site address</Label>
              <Textarea
                id="site_address"
                name="site_address"
                rows={2}
                defaultValue={customer?.site_address ?? ""}
                className="mt-2 min-h-20"
                placeholder="Leave blank if same as address"
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
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-caps text-secondary">
              Category / profession
            </legend>
            <div className="grid gap-2">
              {PROFESSIONS.map((item) => (
                <CheckRow
                  key={item}
                  name="profession"
                  value={item}
                  defaultChecked={professions.includes(item)}
                />
              ))}
            </div>
            <Input
              name="profession_other"
              placeholder="Other profession"
              defaultValue={customer?.profession_other ?? ""}
              className="h-11 min-h-11"
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-caps text-secondary">
              Type of property
            </legend>
            {PROPERTY_TYPES.map((item) => (
              <label
                key={item}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-outline-variant bg-surface px-3 text-sm"
              >
                <input
                  type="radio"
                  name="property_type"
                  value={item}
                  defaultChecked={customer?.property_type === item}
                  className="size-5 accent-primary"
                />
                {item}
              </label>
            ))}
            <Input
              name="property_other"
              placeholder="Other property type"
              defaultValue={customer?.property_other ?? ""}
              className="h-11 min-h-11"
            />
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-caps text-secondary">
              Project status
            </legend>
            {PROJECT_STATUSES.map((item) => (
              <label
                key={item}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-outline-variant bg-surface px-3 text-sm"
              >
                <input
                  type="radio"
                  name="project_status"
                  value={item}
                  defaultChecked={customer?.project_status === item}
                  className="size-5 accent-primary"
                />
                {item}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-caps text-secondary">
              Interested in
            </legend>
            <div className="grid gap-2">
              {INTERESTS.map((item) => (
                <CheckRow
                  key={item}
                  name="interests"
                  value={item}
                  defaultChecked={interests.includes(item)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-caps text-secondary">
              How did you hear about us?
            </legend>
            {HEAR_SOURCES.map((item) => (
              <label
                key={item}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-outline-variant bg-surface px-3 text-sm"
              >
                <input
                  type="radio"
                  name="source"
                  value={item}
                  defaultChecked={customer?.source === item}
                  className="size-5 accent-primary"
                />
                {item}
              </label>
            ))}
            <Input
              name="source_other"
              placeholder="Other source"
              defaultValue={customer?.source_other ?? ""}
              className="h-11 min-h-11"
            />
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="text-label-caps text-secondary">Follow-up</legend>
            <div>
              <Label htmlFor="follow_up_on">Next follow-up date</Label>
              <Input
                id="follow_up_on"
                name="follow_up_on"
                type="date"
                defaultValue={customer?.follow_up_on ?? ""}
                className="mt-2 h-11 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="follow_up_action">Action planned</Label>
              <select
                id="follow_up_action"
                name="follow_up_action"
                defaultValue={customer?.follow_up_action ?? ""}
                className="mt-2 h-11 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3"
              >
                <option value="">Select</option>
                {FOLLOW_UP_ACTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="notes">Remarks / notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={customer?.notes ?? ""}
                className="mt-2 min-h-24"
              />
            </div>
          </fieldset>
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full min-h-12">
            {pending ? "Saving…" : "Save"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
