"use client";

import { useActionState } from "react";
import { saveLeadAction, convertLeadAction, type ActionState } from "@/app/actions/leads";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function LeadForm({
  lead,
}: {
  lead?: {
    id: string;
    name: string | null;
    phone: string | null;
    firm: string | null;
    place: string | null;
    remarks: string | null;
    follow_up_on: string | null;
    source: string | null;
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveLeadAction,
    {},
  );
  return (
    <FormSheet
      title={lead ? "Edit lead" : "Add lead"}
      trigger={
        <span className="inline-flex h-11 min-h-11 items-center rounded-lg bg-primary px-4 text-subheading text-on-primary">
          {lead ? "Edit" : "Add lead"}
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        {lead ? <input type="hidden" name="id" value={lead.id} /> : null}
        <FormSheetBody className="flex flex-col gap-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required defaultValue={lead?.name ?? ""} className="mt-2 h-11 min-h-11" />
          </div>
          <div>
            <Label htmlFor="firm">Firm</Label>
            <Input id="firm" name="firm" defaultValue={lead?.firm ?? ""} className="mt-2 h-11 min-h-11" />
          </div>
          <div>
            <Label htmlFor="place">Place</Label>
            <Input id="place" name="place" defaultValue={lead?.place ?? ""} className="mt-2 h-11 min-h-11" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={lead?.phone ?? ""} className="mt-2 h-11 min-h-11" />
          </div>
          <div>
            <Label htmlFor="follow_up_on">Follow-up</Label>
            <Input id="follow_up_on" name="follow_up_on" type="date" defaultValue={lead?.follow_up_on ?? ""} className="mt-2 h-11 min-h-11" />
          </div>
          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" defaultValue={lead?.remarks ?? ""} className="mt-2" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} className="w-full" size="lg">
            {pending ? "Saving…" : "Save"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState(convertLeadAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={leadId} />
      <Button type="submit" variant="outline" disabled={pending} size="sm">
        {pending ? "Converting…" : "Convert to customer"}
      </Button>
      {state.error ? <p className="mt-1 text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
