"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createAndSubmitQuoteAction,
  reviseQuoteAction,
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
}) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(step);
  const [customerId, setCustomerId] = useState(
    presetCustomerId ?? customers[0]?.id ?? "",
  );
  const [lines, setLines] = useState<QuoteLine[]>(initialLines);
  const [notes, setNotes] = useState(initialNotes);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    reviseQuoteId ? reviseQuoteAction : createAndSubmitQuoteAction,
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
    <div className="flex flex-col gap-6">
      {rejectionReason ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
            Returned by Accounts
          </p>
          <p className="mt-1 text-sm text-on-error-container">{rejectionReason}</p>
        </div>
      ) : null}

      {showCustomerStep ? (
        <nav aria-label="Quote steps" className="flex gap-2">
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
                "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                activeStep === s.n
                  ? "border-primary bg-primary text-on-primary"
                  : "border-surface-variant bg-surface-container-lowest text-on-surface-variant",
              )}
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-current/10 text-xs">
                {s.n}
              </span>
              {s.label}
            </button>
          ))}
        </nav>
      ) : null}

      {activeStep === 1 && showCustomerStep ? (
        <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
          <h2 className="text-headline-sm text-on-surface">Profile check</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Select an existing customer or create a new lead.
          </p>
          <div className="mt-4">
            <CustomerPicker
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              returnTo={returnTo}
            />
          </div>
          <Button
            type="button"
            className="mt-6 h-11 w-full md:w-auto"
            disabled={!customerId}
            onClick={() => setActiveStep(2)}
          >
            Continue to materials
          </Button>
        </section>
      ) : null}

      {activeStep !== 1 || !showCustomerStep ? (
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />

        {activeStep === 2 ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
              <h2 className="text-headline-sm text-on-surface">
                Materials + pricing
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Browse by category, select multiple items, or add custom lines.
              </p>
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
                variant="outline"
                className="mt-4 h-11 w-full"
                onClick={addCustom}
              >
                + Custom line
              </Button>
            </section>

            <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
              <div className="flex items-center justify-between">
                <h2 className="text-headline-sm text-on-surface">
                  Line items ({lines.length})
                </h2>
                {showCustomerStep ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveStep(3)}
                    disabled={lines.length === 0}
                  >
                    Review →
                  </Button>
                ) : null}
              </div>

              {lines.length === 0 ? (
                <p className="mt-6 text-center text-sm text-on-surface-variant">
                  Add materials from the catalogue to build the quote.
                </p>
              ) : (
                <ul className="mt-4 flex max-h-[520px] flex-col gap-3 overflow-y-auto">
                  {lines.map((line) => (
                    <li
                      key={line.key}
                      className="rounded-lg border border-surface-variant bg-surface p-4"
                    >
                      <div className="flex items-start gap-2">
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.key, { description: e.target.value })
                          }
                          className="h-10 flex-1 font-medium"
                          aria-label="Item description"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-destructive"
                          onClick={() => removeLine(line.key)}
                          aria-label="Remove line"
                        >
                          ✕
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-sm text-on-surface-variant">
                          Qty
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="size-9"
                            onClick={() =>
                              updateLine(line.key, {
                                quantity: Math.max(1, line.quantity - 1),
                              })
                            }
                          >
                            −
                          </Button>
                          <span className="w-8 text-center font-medium">
                            {line.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            className="size-9"
                            onClick={() =>
                              updateLine(line.key, {
                                quantity: line.quantity + 1,
                              })
                            }
                          >
                            +
                          </Button>
                        </div>
                      </div>
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
                      <p className="mt-2 text-right text-sm font-semibold">
                        {formatInrExact(
                          line.quantity * line.unit_price -
                            line.discount +
                            line.tax,
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {activeStep === 3 || !showCustomerStep ? (
          <section className="rounded-xl border border-surface-variant bg-surface-container-lowest p-5 shadow-card">
            <h2 className="text-headline-sm text-on-surface">Review & submit</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Submit to Accounts for approval. The customer never sees a draft.
            </p>

            <div className="mt-4">
              <Label htmlFor="notes">Notes for Accounts (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-2"
                placeholder="Special terms, delivery timeline, etc."
              />
            </div>

            <dl className="mt-4 space-y-2 border-t border-surface-variant pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Subtotal</dt>
                <dd>{formatInrExact(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Discount</dt>
                <dd>{formatInrExact(totals.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Tax</dt>
                <dd>{formatInrExact(totals.tax)}</dd>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <dt>Total</dt>
                <dd>{formatInrExact(totals.total)}</dd>
              </div>
            </dl>

            {state.error ? (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {showCustomerStep ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveStep(2)}
                >
                  ← Back to materials
                </Button>
              ) : null}
              <Button
                type="submit"
                size="lg"
                disabled={
                  pending ||
                  (!reviseQuoteId && !customerId) ||
                  lines.length === 0
                }
                className="md:ml-auto"
              >
                {pending
                  ? "Submitting…"
                  : reviseQuoteId
                    ? "Submit revised quote"
                    : "Submit to Accounts"}
              </Button>
            </div>
          </section>
        ) : null}

        {activeStep === 2 && showCustomerStep ? (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={lines.length === 0}
              onClick={() => setActiveStep(3)}
            >
              Continue to review →
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
