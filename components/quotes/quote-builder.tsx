"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveQuoteAction,
  type ActionState,
} from "@/app/actions/workflow";
import { CustomerPicker } from "@/components/quotes/customer-picker";
import {
  MaterialPicker,
  type PickerMaterial,
} from "@/components/quotes/material-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatInrExact } from "@/lib/format/money";
import { cn } from "@/lib/utils";

export type QuoteLine = {
  key: string;
  material_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  discount: number;
  tax: number;
};

type Customer = { id: string; name: string; phone?: string | null };

function lineFromMaterial(material: PickerMaterial): QuoteLine {
  return {
    key: crypto.randomUUID(),
    material_id: material.id,
    description: material.name,
    quantity: 1,
    unit_price: Number(material.default_sell_price),
    unit_cost: Number(material.default_cost),
    discount: 0,
    tax: 0,
  };
}

export function QuoteBuilder({
  customers,
  materials,
  categories,
  presetCustomerId,
  reviseQuoteId,
  initialLines = [],
  initialNotes = "",
  rejectionReason,
  returnTo = "/walk-in",
  step = 2,
  showCustomerStep = true,
  quoteStatus,
}: {
  customers: Customer[];
  materials: PickerMaterial[];
  categories: { id: string; name: string }[];
  presetCustomerId?: string;
  reviseQuoteId?: string;
  initialLines?: QuoteLine[];
  initialNotes?: string;
  rejectionReason?: string;
  returnTo?: string;
  step?: 1 | 2 | 3;
  showCustomerStep?: boolean;
  quoteStatus?: "quote_draft" | "quote_rejected" | "quote_approved";
}) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(step);
  const [customerId, setCustomerId] = useState(
    presetCustomerId ?? customers[0]?.id ?? "",
  );
  const [lines, setLines] = useState<QuoteLine[]>(initialLines);
  const [notes, setNotes] = useState(initialNotes);
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveQuoteAction,
    {},
  );

  const addedMaterialIds = useMemo(
    () => new Set(lines.map((l) => l.material_id).filter(Boolean) as string[]),
    [lines],
  );

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const discount = lines.reduce((s, l) => s + l.discount, 0);
    const tax = lines.reduce((s, l) => s + l.tax, 0);
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [lines]);

  function addMaterial(material: PickerMaterial) {
    setLines((current) => [...current, lineFromMaterial(material)]);
  }

  function addManyMaterials(selected: PickerMaterial[]) {
    setLines((current) => [
      ...current,
      ...selected.map((m) => lineFromMaterial(m)),
    ]);
  }

  function addCustom() {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        description: "Custom item",
        quantity: 1,
        unit_price: 0,
        unit_cost: 0,
        discount: 0,
        tax: 0,
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((rows) => rows.filter((r) => r.key !== key));
  }

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    setLines((rows) =>
      rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  const itemPayload = lines.map((line) => ({
    material_id: line.material_id,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unit_price,
    unit_cost: line.unit_cost,
    discount: line.discount,
    tax: line.tax,
  }));

  const payload = reviseQuoteId
    ? { quote_id: reviseQuoteId, items: itemPayload, notes: notes || undefined }
    : {
        customer_id: customerId,
        items: itemPayload,
        notes: notes || undefined,
      };

  const steps = [
    { n: 1 as const, label: "Customer" },
    { n: 2 as const, label: "Materials" },
    { n: 3 as const, label: "Review" },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {rejectionReason ? (
        <div className="rounded-lg border border-l-[3px] border-border border-l-error bg-card px-4 py-3">
          <p className="text-[12px] font-medium text-error">Returned by Accounts</p>
          <p className="mt-1 text-sm text-on-surface">{rejectionReason}</p>
        </div>
      ) : null}

      {quoteStatus === "quote_approved" ? (
        <div className="rounded-lg border border-l-[3px] border-border border-l-warning bg-card px-4 py-3">
          <p className="text-[12px] font-medium text-warning">Approved quote</p>
          <p className="mt-1 text-sm text-on-surface">
            Editing creates a new version and sends it back to Accounts.
          </p>
        </div>
      ) : null}

      {showCustomerStep ? (
        <nav aria-label="Quote steps" className="relative flex gap-1 overflow-hidden rounded-lg bg-surface-container-high p-1">
          {steps.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => {
                if (s.n === 2 && !customerId) return;
                if (s.n === 3 && lines.length === 0) return;
                setActiveStep(s.n);
              }}
              className={cn(
                "relative z-10 flex min-w-0 flex-1 items-center justify-center rounded-md px-2 py-2 text-subheading transition-colors",
                activeStep === s.n
                  ? "bg-card text-primary shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                  : "text-outline",
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>
      ) : null}

      {activeStep === 1 && showCustomerStep ? (
        <section className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
          <h2 className="text-headline-md text-on-surface">Customer Details</h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            Select an existing customer or create a new one.
          </p>
          <div className="mt-4">
            <CustomerPicker
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              returnTo={returnTo}
            />
          </div>
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 bg-gradient-to-t from-background via-background to-transparent px-4 pt-6 pb-1 md:static md:mx-0 md:bg-none md:px-0 md:pt-6">
            <Button
              type="button"
              className="h-11 w-full"
              disabled={!customerId}
              onClick={() => setActiveStep(2)}
            >
              Continue to materials
            </Button>
          </div>
        </section>
      ) : null}

      {activeStep !== 1 || !showCustomerStep ? (
      <form action={action} className="flex min-w-0 flex-col gap-4">
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />

        {activeStep === 2 ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
              <h2 className="text-subheading uppercase tracking-wider text-primary">
                Catalogue
              </h2>
              <div className="mt-4">
                <MaterialPicker
                  materials={materials}
                  categories={categories}
                  addedMaterialIds={addedMaterialIds}
                  onAdd={addMaterial}
                  onAddMany={addManyMaterials}
                />
              </div>
              <Button
                type="button"
                variant="bordered"
                className="mt-4 h-11 w-full"
                onClick={addCustom}
              >
                + Custom line
              </Button>
            </section>

            <section className="min-w-0 rounded-lg border border-outline-variant bg-card p-4 shadow-card">
              <h2 className="text-subheading uppercase tracking-wider text-primary">
                Line Items ({lines.length})
              </h2>

              {lines.length === 0 ? (
                <p className="mt-6 text-center text-sm text-on-surface-variant">
                  Add materials from the catalogue to build the quote.
                </p>
              ) : (
                <ul className="mt-4 flex max-h-[520px] flex-col gap-4 overflow-y-auto">
                  {lines.map((line) => (
                    <li
                      key={line.key}
                      className="min-w-0 border-b border-surface-variant pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.key, { description: e.target.value })
                          }
                          className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-body-md font-semibold shadow-none"
                          aria-label="Item description"
                        />
                        <div className="flex shrink-0 items-center gap-2">
                          <p className="text-data-tabular font-semibold">
                            {formatInrExact(
                              line.quantity * line.unit_price -
                                line.discount +
                                line.tax,
                            )}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-destructive"
                            onClick={() => removeLine(line.key)}
                            aria-label="Remove line"
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <button
                          type="button"
                          className="text-body-sm text-secondary underline underline-offset-2"
                          onClick={() =>
                            setOpenLine((current) =>
                              current === line.key ? null : line.key,
                            )
                          }
                        >
                          {openLine === line.key ? "Hide price" : "Edit price"}
                        </button>
                        <div className="flex items-center gap-3 rounded-full border border-surface-variant bg-surface-container px-2 py-1">
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center rounded-full text-secondary hover:bg-surface-variant hover:text-primary"
                            onClick={() =>
                              updateLine(line.key, {
                                quantity: Math.max(1, line.quantity - 1),
                              })
                            }
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="min-w-[1ch] text-center text-data-tabular">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center rounded-full text-secondary hover:bg-surface-variant hover:text-primary"
                            onClick={() =>
                              updateLine(line.key, {
                                quantity: line.quantity + 1,
                              })
                            }
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {openLine === line.key ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Price</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            className="mt-1 h-10"
                            value={line.unit_price}
                            onChange={(e) =>
                              updateLine(line.key, {
                                unit_price: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Discount</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            className="mt-1 h-10"
                            value={line.discount}
                            onChange={(e) =>
                              updateLine(line.key, {
                                discount: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tax</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            className="mt-1 h-10"
                            value={line.tax}
                            onChange={(e) =>
                              updateLine(line.key, {
                                tax: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {activeStep === 3 || !showCustomerStep ? (
          <div className="flex min-w-0 flex-col gap-3">
            {showCustomerStep ? (
              <div className="flex items-center gap-4 rounded-lg border border-surface-variant bg-card p-4">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-headline-md text-on-secondary-container">
                  {(customers.find((c) => c.id === customerId)?.name ?? "C")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-subheading text-on-surface">
                    {customers.find((c) => c.id === customerId)?.name ??
                      "Customer"}
                  </p>
                  <p className="truncate text-body-sm text-on-surface-variant">
                    {customers.find((c) => c.id === customerId)?.phone ??
                      "No phone"}
                  </p>
                </div>
              </div>
            ) : null}

            <section className="rounded-lg border border-surface-variant bg-card">
              <div className="flex items-center justify-between border-b border-surface-variant p-4">
                <h2 className="text-subheading text-on-surface">Order Items</h2>
                <span className="rounded bg-surface-container-high px-2 py-1 text-label-caps">
                  {lines.length} {lines.length === 1 ? "ITEM" : "ITEMS"}
                </span>
              </div>
              <ul>
                {lines.map((line) => (
                  <li
                    key={line.key}
                    className="flex items-start justify-between gap-4 border-b border-surface-variant p-4 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-subheading text-on-surface">
                        {line.description}
                      </p>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        Qty: {line.quantity}
                      </p>
                    </div>
                    <p className="shrink-0 text-data-tabular">
                      {formatInrExact(
                        line.quantity * line.unit_price -
                          line.discount +
                          line.tax,
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-2"
                placeholder="Add any special instructions or customer requests..."
              />
            </div>

            {quoteStatus === "quote_approved" ? (
              <p className="text-body-sm text-on-surface-variant">
                Saving a correction withdraws Accounts approval. They must
                approve the new version before you can send it.
              </p>
            ) : null}

            <section className="flex flex-col gap-3 rounded-lg border border-surface-variant bg-card p-4">
              <div className="flex justify-between text-body-md">
                <span className="text-on-surface-variant">Subtotal</span>
                <span className="text-data-tabular">
                  {formatInrExact(totals.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-body-md text-error">
                <span>Discount</span>
                <span className="text-data-tabular">
                  -{formatInrExact(totals.discount)}
                </span>
              </div>
              <div className="flex justify-between text-body-md">
                <span className="text-on-surface-variant">Tax</span>
                <span className="text-data-tabular">
                  {formatInrExact(totals.tax)}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-surface-variant pt-3">
                <span className="text-headline-md">Total</span>
                <span className="text-headline-md">
                  {formatInrExact(totals.total)}
                </span>
              </div>
            </section>

            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}

            <div className="mt-3 flex flex-col gap-3">
              <Button
                type="submit"
                name="intent"
                value="draft"
                variant="bordered"
                size="lg"
                className="w-full"
                disabled={
                  pending ||
                  (!reviseQuoteId && !customerId) ||
                  lines.length === 0
                }
              >
                {pending ? "Saving…" : "Save draft"}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="submit"
                size="lg"
                className="w-full"
                disabled={
                  pending ||
                  (!reviseQuoteId && !customerId) ||
                  lines.length === 0
                }
              >
                {pending
                  ? "Submitting…"
                  : reviseQuoteId && quoteStatus !== "quote_draft"
                    ? "Submit revised quote"
                    : "Submit to Accounts"}
              </Button>
            </div>
          </div>
        ) : null}

        {activeStep === 2 && showCustomerStep ? (
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex justify-end border-t border-outline-variant bg-card px-4 py-3 md:static md:mx-0 md:rounded-lg md:border">
            <Button
              type="button"
              size="lg"
              disabled={lines.length === 0}
              onClick={() => setActiveStep(3)}
            >
              Review
            </Button>
          </div>
        ) : null}
      </form>
      ) : null}
    </div>
  );
}

export function linesFromQuoteItems(
  items: {
    material_id: string | null;
    description: string;
    quantity: number | string;
    unit_price: number | string;
    unit_cost: number | string;
    discount: number | string;
    tax: number | string;
  }[],
): QuoteLine[] {
  return items.map((item) => ({
    key: crypto.randomUUID(),
    material_id: item.material_id ?? undefined,
    description: item.description,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    unit_cost: Number(item.unit_cost),
    discount: Number(item.discount),
    tax: Number(item.tax),
  }));
}
