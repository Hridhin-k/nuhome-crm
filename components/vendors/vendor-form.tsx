"use client";

import { useActionState, useState } from "react";
import { createVendorAdminAction, type AdminActionState } from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocalMobileInput } from "@/components/ui/local-mobile-input";
import { sanitizeLocalMobileInput } from "@/lib/customers/phone";
import { FormError } from "@/components/app/form-error";
import { NativeSelect } from "@/components/ui/native-select";

type ContactDraft = { name: string; phone: string; email: string };

export function VendorForm({
  triggerClassName = "w-auto",
  vendor,
}: {
  triggerClassName?: string;
  vendor?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes?: string | null;
    is_active: boolean;
    contacts?: ContactDraft[];
  };
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    createVendorAdminAction,
    {},
  );
  const [phone, setPhone] = useState(sanitizeLocalMobileInput(vendor?.phone ?? ""));
  const [contacts, setContacts] = useState<ContactDraft[]>(
    vendor?.contacts?.length
      ? vendor.contacts.map((contact) => ({
          ...contact,
          phone: sanitizeLocalMobileInput(contact.phone),
        }))
      : [{ name: "", phone: "", email: "" }],
  );
  const editing = Boolean(vendor);

  return (
    <FormSheet
      title={editing ? "Edit vendor" : "Add vendor"}
      description="Used when sending an activated order. Extra contacts are for mobile numbers besides the main one."
      triggerClassName={triggerClassName}
      trigger={
        <span
          className={
            editing
              ? buttonVariants({ variant: "outline", size: "sm" })
              : cn(buttonVariants(), "w-full")
          }
        >
          {editing ? "Edit" : "Add vendor"}
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        {vendor ? <input type="hidden" name="id" value={vendor.id} /> : null}
        <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor={`name-${vendor?.id ?? "new"}`}>Name</Label>
          <Input
            id={`name-${vendor?.id ?? "new"}`}
            name="name"
            required
            defaultValue={vendor?.name}
            className="h-11 min-h-11"
          />
          <Label htmlFor={`phone-${vendor?.id ?? "new"}`}>Phone</Label>
          <LocalMobileInput
            id={`phone-${vendor?.id ?? "new"}`}
            name="phone"
            value={phone}
            onChange={setPhone}
            className="h-11 min-h-11"
          />
          <Label htmlFor={`email-${vendor?.id ?? "new"}`}>Email</Label>
          <Input
            id={`email-${vendor?.id ?? "new"}`}
            name="email"
            type="email"
            defaultValue={vendor?.email ?? ""}
            className="h-11 min-h-11"
          />
          <Label htmlFor={`notes-${vendor?.id ?? "new"}`}>Notes</Label>
          <Textarea
            id={`notes-${vendor?.id ?? "new"}`}
            name="notes"
            rows={3}
            defaultValue={vendor?.notes ?? ""}
          />
          {vendor ? (
            <div>
              <Label htmlFor={`active-${vendor.id}`}>Status</Label>
              <NativeSelect
                id={`active-${vendor.id}`}
                name="is_active"
                defaultValue={vendor.is_active ? "true" : "false"}
                wrapperClassName="mt-2 w-full"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </NativeSelect>
            </div>
          ) : null}
          <div>
            <p className="text-sm font-medium">Extra contacts</p>
            <ul className="mt-2 flex flex-col gap-3">
              {contacts.map((contact, index) => (
                <li
                  key={index}
                  className="grid gap-2 rounded-xl border border-outline-variant p-3"
                >
                  <Input
                    placeholder="Name"
                    value={contact.name}
                    onChange={(e) =>
                      setContacts((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, name: e.target.value } : row,
                        ),
                      )
                    }
                    
                  />
                  <LocalMobileInput
                    id={`contact-phone-${vendor?.id ?? "new"}-${index}`}
                    value={contact.phone}
                    onChange={(next) =>
                      setContacts((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, phone: next } : row,
                        ),
                      )
                    }
                    
                  />
                  <Input
                    placeholder="Email"
                    value={contact.email}
                    onChange={(e) =>
                      setContacts((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, email: e.target.value } : row,
                        ),
                      )
                    }
                    
                  />
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() =>
                setContacts((current) => [
                  ...current,
                  { name: "", phone: "", email: "" },
                ])
              }
            >
              Add contact
            </Button>
          </div>
          {state.error ? (
            <FormError>{state.error}</FormError>
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
