"use client";

import { useActionState } from "react";
import {
  saveWarrantyAction,
  type DocumentActionState,
} from "@/app/actions/documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Coverage = {
  kind: "warranty" | "amc";
  starts_on: string;
  ends_on: string;
  notes: string | null;
};

function CoverageCard({
  orderId,
  kind,
  coverage,
  title,
  description,
}: {
  orderId: string;
  kind: "warranty" | "amc";
  coverage?: Coverage;
  title: string;
  description: string;
}) {
  const [state, action, pending] = useActionState<DocumentActionState, FormData>(
    saveWarrantyAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="kind" value={kind} />
      <div>
        <h3 className="text-subheading text-on-surface">{title}</h3>
        <p className="mt-1 text-body-sm text-on-surface-variant">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${kind}-start`}>Starts</Label>
          <Input
            id={`${kind}-start`}
            name="starts_on"
            type="date"
            required
            defaultValue={coverage?.starts_on?.slice(0, 10) ?? ""}
            className="mt-2 h-11"
          />
        </div>
        <div>
          <Label htmlFor={`${kind}-end`}>Ends</Label>
          <Input
            id={`${kind}-end`}
            name="ends_on"
            type="date"
            required
            defaultValue={coverage?.ends_on?.slice(0, 10) ?? ""}
            className="mt-2 h-11"
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${kind}-notes`}>Notes</Label>
        <Textarea
          id={`${kind}-notes`}
          name="notes"
          rows={2}
          defaultValue={coverage?.notes ?? ""}
          className="mt-2"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="bordered" disabled={pending}>
        {pending ? "Saving…" : coverage ? "Update" : "Save"}
      </Button>
    </form>
  );
}

export function WarrantyPanel({
  orderId,
  rows,
  canEdit = false,
}: {
  orderId: string;
  rows: Coverage[];
  canEdit?: boolean;
}) {
  const warranty = rows.find((row) => row.kind === "warranty");
  const amc = rows.find((row) => row.kind === "amc");

  return (
    <section className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
      <h2 className="text-subheading text-on-surface">Warranty / AMC</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Quoted on the quotation and started on delivery.
      </p>
      {canEdit ? (
        <div className="mt-4 flex flex-col gap-6">
          <CoverageCard
            orderId={orderId}
            kind="warranty"
            coverage={warranty}
            title="Warranty"
            description="Default term comes from the catalogue when goods are handed over."
          />
          <CoverageCard
            orderId={orderId}
            kind="amc"
            coverage={amc}
            title="AMC"
            description="Annual maintenance, if sold."
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          {warranty ? (
            <p>Warranty {warranty.starts_on} → {warranty.ends_on}</p>
          ) : (
            <p className="text-on-surface-variant">Warranty starts on delivery.</p>
          )}
          {amc ? <p>AMC {amc.starts_on} → {amc.ends_on}</p> : <p className="text-on-surface-variant">No AMC on this quote.</p>}
        </div>
      )}
    </section>
  );
}
