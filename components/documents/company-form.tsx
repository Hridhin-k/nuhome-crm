"use client";

import { useActionState } from "react";
import {
  saveCompanySettingsAction,
  type DocumentActionState,
} from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CompanyForm({
  company,
}: {
  company: {
    legal_name: string;
    gstin: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    state_code: string | null;
    default_gst_rate: number;
    bank_name?: string | null;
    bank_account?: string | null;
    bank_ifsc?: string | null;
    bank_branch?: string | null;
    upi_id?: string | null;
  };
}) {
  const [state, action, pending] = useActionState<DocumentActionState, FormData>(
    saveCompanySettingsAction,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="legal_name">Legal name</Label>
        <Input
          id="legal_name"
          name="legal_name"
          required
          defaultValue={company.legal_name}
          className="mt-2 h-11"
        />
      </div>
      <div>
        <Label htmlFor="gstin">GSTIN</Label>
        <Input
          id="gstin"
          name="gstin"
          maxLength={15}
          defaultValue={company.gstin ?? ""}
          className="mt-2 h-11 uppercase"
        />
      </div>
      <div>
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          name="address"
          rows={3}
          defaultValue={company.address ?? ""}
          className="mt-2"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={company.phone ?? ""}
            className="mt-2 h-11"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={company.email ?? ""}
            className="mt-2 h-11"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="state_code">State code</Label>
          <Input
            id="state_code"
            name="state_code"
            maxLength={2}
            placeholder="32"
            defaultValue={company.state_code ?? ""}
            className="mt-2 h-11"
          />
        </div>
        <div>
          <Label htmlFor="default_gst_rate">Default GST %</Label>
          <Input
            id="default_gst_rate"
            name="default_gst_rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            defaultValue={String(company.default_gst_rate)}
            className="mt-2 h-11"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="bank_name">Bank name</Label>
        <Input
          id="bank_name"
          name="bank_name"
          defaultValue={company.bank_name ?? ""}
          className="mt-2 h-11"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="bank_account">Account number</Label>
          <Input
            id="bank_account"
            name="bank_account"
            defaultValue={company.bank_account ?? ""}
            className="mt-2 h-11"
          />
        </div>
        <div>
          <Label htmlFor="bank_ifsc">IFSC</Label>
          <Input
            id="bank_ifsc"
            name="bank_ifsc"
            defaultValue={company.bank_ifsc ?? ""}
            className="mt-2 h-11 uppercase"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="bank_branch">Bank branch</Label>
        <Input
          id="bank_branch"
          name="bank_branch"
          defaultValue={company.bank_branch ?? ""}
          className="mt-2 h-11"
        />
      </div>
      <div>
        <Label htmlFor="upi_id">UPI ID</Label>
        <Input
          id="upi_id"
          name="upi_id"
          defaultValue={company.upi_id ?? ""}
          className="mt-2 h-11"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save company details"}
      </Button>
    </form>
  );
}
