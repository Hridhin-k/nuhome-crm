"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  saveQuoteAction,
  type ActionState,
} from "@/app/actions/workflow";
import { ItemDescriptionHint } from "@/components/app/item-description-hint";
import { markActionPending } from "@/components/app/submit-button";
import { CustomerPicker } from "@/components/quotes/customer-picker";
import {
  MaterialPicker,
  type PickerMaterial,
} from "@/components/quotes/material-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lineTotalWithGst } from "@/lib/gst";
import { formatInrExact } from "@/lib/format/money";
import { withGst, type QuoteLine } from "@/lib/quotes/lines";
import {
  addCatalogueMaterial,
  setLineQuantity,
  setLineSupply,
} from "@/lib/quotes/supply";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/app/form-error";
import { chipVariants } from "@/components/ui/chip";

export type { QuoteLine };

type Customer = { id: string; name: string; phone?: string | null };

export function QuoteBuilder({
  customers,
  materials,
  categories,
  presetCustomerId,
  reviseQuoteId,
  initialLines = [],
  initialNotes = "",
  initialWarrantyMonths = 12,
  initialIncludeAmc = false,
  initialAmcMonths = 12,
  rejectionReason,
  returnTo = "/walk-in",
  step = 2,
  showCustomerStep = true,
  quoteStatus,
  showCost = false,
}: {
  customers: Customer[];
  materials: PickerMaterial[];
  categories: { id: string; name: string }[];
  presetCustomerId?: string;
  reviseQuoteId?: string;
  initialLines?: QuoteLine[];
  initialNotes?: string;
  initialWarrantyMonths?: number;
  initialIncludeAmc?: boolean;
  initialAmcMonths?: number;
  rejectionReason?: string;
  returnTo?: string;
  step?: 1 | 2 | 3;
  showCustomerStep?: boolean;
  quoteStatus?: "quote_draft" | "quote_rejected" | "quote_approved" | "quote_sent_to_customer";
  showCost?: boolean;
}) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(step);
  const [customerId, setCustomerId] = useState(
    presetCustomerId ?? customers[0]?.id ?? "",
  );
  const [lines, setLines] = useState<QuoteLine[]>(initialLines);
  const [notes, setNotes] = useState(initialNotes);
  const [warrantyMonths, setWarrantyMonths] = useState(String(initialWarrantyMonths));
  const [includeAmc, setIncludeAmc] = useState(initialIncludeAmc);
  const [amcMonths, setAmcMonths] = useState(String(initialAmcMonths));
  const [openLine, setOpenLine] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveQuoteAction,
    {},
  );

  useEffect(() => {
    if (pending) markActionPending();
  }, [pending]);

  const addedMaterialIds = useMemo(
    () => new Set(lines.map((l) => l.material_id).filter(Boolean) as string[]),
    [lines],
  );

  const shelfByMaterial = useMemo(() => {
    const map = new Map<string, number>();
    for (const material of materials) {
      map.set(material.id, Number(material.office_available ?? 0));
    }
    return map;
  }, [materials]);

  const materialById = useMemo(() => {
    const map = new Map<string, PickerMaterial>();
    for (const material of materials) {
      map.set(material.id, material);
    }
    return map;
  }, [materials]);

  function materialDescriptionFor(line: QuoteLine) {
    if (line.material_id) {
      const fromCatalog = materialById.get(line.material_id)?.description?.trim();
      if (fromCatalog) return fromCatalog;
    }
    return line.specification?.trim() ?? "";
  }

  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
    const discount = lines.reduce((s, l) => s + l.discount, 0);
    const tax = lines.reduce((s, l) => s + l.tax, 0);
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [lines]);

  function addMaterial(material: PickerMaterial) {
    setLines((current) =>
      addCatalogueMaterial(current, material, shelfByMaterial),
    );
  }

  function addManyMaterials(selected: PickerMaterial[]) {
    setLines((current) =>
      selected.reduce(
        (rows, material) => addCatalogueMaterial(rows, material, shelfByMaterial),
        current,
      ),
    );
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
        gst_rate: 0,
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((rows) => rows.filter((r) => r.key !== key));
  }

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    setLines((rows) =>
      rows.map((r) => (r.key === key ? withGst({ ...r, ...patch }) : r)),
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
    specification: line.specification,
    item_code: line.item_code,
    hsn_code: line.hsn_code,
    gst_rate: line.gst_rate,
    supply_source: line.supply_source ?? "vendor",
  }));

  const extras = {
    warranty_months: Number(warrantyMonths) || 0,
    include_amc: includeAmc,
    amc_months: includeAmc ? Number(amcMonths) || 0 : 0,
  };
  const payload = reviseQuoteId
    ? { quote_id: reviseQuoteId, items: itemPayload, notes: notes || undefined, ...extras }
    : {
        customer_id: customerId,
        items: itemPayload,
        notes: notes || undefined,
        ...extras,
      };

  const steps = [
    { n: 1 as const, label: "Customer" },
    { n: 2 as const, label: "Materials" },
    { n: 3 as const, label: "Review" },
  ];

  const stepNav = (
    <nav
      aria-label="Quote steps"
      className="relative flex gap-1 overflow-hidden rounded-xl bg-surface-container-high p-1"
    >
      {steps
        .filter((s) => showCustomerStep || s.n !== 1)
        .map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => {
              if (s.n === 2 && showCustomerStep && !customerId) return;
              if (s.n === 3 && lines.length === 0) return;
              setActiveStep(s.n);
            }}
            className={cn(
              "relative z-10 flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-subheading transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              activeStep === s.n
                ? "bg-card text-primary shadow-card"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {s.label}
          </button>
        ))}
    </nav>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {rejectionReason ? (
        <div className="rounded-2xl border border-l-4 border-outline-variant border-l-error bg-card px-4 py-3 shadow-card">
          <p className="text-label-caps uppercase text-error">Returned by Accounts</p>
          <p className="mt-1 text-sm text-on-surface">{rejectionReason}</p>
        </div>
      ) : null}

      {quoteStatus === "quote_approved" ? (
        <div className="rounded-2xl border border-l-4 border-outline-variant border-l-warning bg-card px-4 py-3 shadow-card">
          <p className="text-label-caps uppercase text-warning">Approved quote</p>
          <p className="mt-1 text-sm text-on-surface">
            Editing creates a new version and sends it back to Accounts.
          </p>
        </div>
      ) : null}

      {showCustomerStep ? stepNav : null}

      {activeStep === 1 && showCustomerStep ? (
        <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
          <h2 className="text-subheading text-on-surface">Customer details</h2>
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
        {!showCustomerStep ? stepNav : null}
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />

        {activeStep === 2 ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
              <h2 className="text-subheading text-on-surface">
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

            <section className="min-w-0 rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
              <h2 className="text-subheading text-on-surface">
                Line items ({lines.length})
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
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <Input
                            value={line.description}
                            onChange={(e) =>
                              updateLine(line.key, { description: e.target.value })
                            }
                            className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-body-md font-semibold shadow-none"
                            aria-label="Item description"
                          />
                          <ItemDescriptionHint
                            description={materialDescriptionFor(line)}
                            className="mt-1.5"
                          />
                        </div>
                        <div className="flex h-10 shrink-0 items-center gap-2">
                          <p className="text-data-tabular font-semibold">
                            {formatInrExact(
                              lineTotalWithGst(
                                line.quantity,
                                line.unit_price,
                                line.discount,
                                line.gst_rate,
                              ),
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
                            <X className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </div>
                      {line.specification?.trim() && openLine !== line.key ? (
                        <p className="mt-1 text-body-sm text-on-surface-variant">
                          {line.specification.trim()}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between">
                        <button
                          type="button"
                          className={cn(buttonVariants({ variant: "link", size: "xs" }), "px-0")}
                          onClick={() =>
                            setOpenLine((current) =>
                              current === line.key ? null : line.key,
                            )
                          }
                        >
                          {openLine === line.key ? "Hide details" : "Edit price or specs"}
                        </button>
                        <div className="flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low p-0.5">
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-full text-on-surface transition-colors outline-none hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary/30"
                            onClick={() =>
                              setLines((current) => {
                                const row = current.find((item) => item.key === line.key);
                                if (!row) return current;
                                return setLineQuantity(
                                  current,
                                  row.key,
                                  row.quantity - 1,
                                  shelfByMaterial,
                                );
                              })
                            }
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="min-w-6 text-center text-data-tabular">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="inline-flex size-8 items-center justify-center rounded-full text-on-surface transition-colors outline-none hover:bg-surface-container-high focus-visible:ring-2 focus-visible:ring-primary/30"
                            onClick={() =>
                              setLines((current) => {
                                const row = current.find((item) => item.key === line.key);
                                if (!row) return current;
                                return setLineQuantity(
                                  current,
                                  row.key,
                                  row.quantity + 1,
                                  shelfByMaterial,
                                );
                              })
                            }
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      {line.material_id ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className={chipVariants({ selected: line.supply_source === "office", size: "sm" })}
                            aria-pressed={line.supply_source === "office"}
                            onClick={() =>
                              setLines((current) =>
                                setLineSupply(current, line.key, "office", shelfByMaterial),
                              )
                            }
                          >
                            From office
                            {line.material_id
                              ? ` (${shelfByMaterial.get(line.material_id) ?? 0})`
                              : ""}
                          </button>
                          <button
                            type="button"
                            className={chipVariants({ selected: line.supply_source !== "office", size: "sm" })}
                            aria-pressed={line.supply_source !== "office"}
                            onClick={() =>
                              setLines((current) =>
                                setLineSupply(current, line.key, "vendor", shelfByMaterial),
                              )
                            }
                          >
                            Order
                          </button>
                          {line.unit_price < line.unit_cost ? (
                            <span className="text-xs text-warning">Below cost</span>
                          ) : null}
                        </div>
                      ) : null}
                      {openLine === line.key ? (
                      <>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <Label className="text-xs">Price</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            className="mt-1"
                            value={line.unit_price}
                            onChange={(e) =>
                              updateLine(line.key, {
                                unit_price: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        {showCost ? (
                        <div>
                          <Label className="text-xs">Cost</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            className="mt-1"
                            value={line.unit_cost}
                            onChange={(e) =>
                              updateLine(line.key, {
                                unit_cost: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        ) : null}
                        <div>
                          <Label className="text-xs">Discount</Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min={0}
                            className="mt-1"
                            value={line.discount}
                            onChange={(e) =>
                              updateLine(line.key, {
                                discount: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">HSN / GST</Label>
                          <p className="mt-2 text-sm text-on-surface-variant">
                            {line.hsn_code ? `HSN ${line.hsn_code}` : "No HSN"}
                            {` · GST ${line.gst_rate}%`}
                            {line.material_id
                              ? " (from catalog)"
                              : " (custom — catalog GST only)"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Label className="text-xs">Specs</Label>
                        <Input
                          className="mt-1"
                          value={line.specification ?? ""}
                          placeholder="Colour, dimensions, site notes"
                          onChange={(e) =>
                            updateLine(line.key, {
                              specification: e.target.value,
                            })
                          }
                        />
                      </div>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        GST {formatInrExact(line.tax)}
                      </p>
                      </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {activeStep === 3 ? (
          <div className="flex min-w-0 flex-col gap-3">
            {showCustomerStep ? (
              <div className="flex items-center gap-4 rounded-2xl border border-outline-variant bg-card shadow-card p-4">
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

            <section className="rounded-2xl border border-outline-variant bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-surface-variant p-4">
                <h2 className="text-subheading text-on-surface">Order items</h2>
                <Badge variant="secondary">
                  {lines.length} {lines.length === 1 ? "item" : "items"}
                </Badge>
              </div>
              <ul>
                {lines.map((line) => (
                  <li
                    key={line.key}
                    className="flex items-start justify-between gap-4 border-b border-surface-variant p-4 last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-2">
                        <p className="min-w-0 flex-1 text-subheading text-on-surface">
                          {line.description}
                        </p>
                        <ItemDescriptionHint
                          description={materialDescriptionFor(line)}
                        />
                      </div>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        Qty: {line.quantity}
                        {line.item_code ? ` · ${line.item_code}` : ""}
                        {line.hsn_code ? ` · HSN ${line.hsn_code}` : ""}
                        {line.gst_rate ? ` · GST ${line.gst_rate}%` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-data-tabular">
                      {formatInrExact(
                        lineTotalWithGst(
                          line.quantity,
                          line.unit_price,
                          line.discount,
                          line.gst_rate,
                        ),
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
              />
            </div>

            <section className="rounded-2xl border border-outline-variant bg-card shadow-card p-4">
              <h2 className="text-subheading text-on-surface">Warranty and AMC</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Optional on the quotation. Delivery still stamps the start date.
              </p>
              <div className="mt-3">
                <Label htmlFor="warranty_months">Warranty (months)</Label>
                <Input
                  id="warranty_months"
                  type="number"
                  min={0}
                  max={120}
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(e.target.value)}
                  className="mt-2 h-11 min-h-11"
                />
              </div>
              <label className="mt-3 flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={includeAmc}
                  onChange={(e) => setIncludeAmc(e.target.checked)}
                  className="size-5 accent-primary"
                />
                Include AMC
              </label>
              {includeAmc ? (
                <div className="mt-3">
                  <Label htmlFor="amc_months">AMC (months)</Label>
                  <Input
                    id="amc_months"
                    type="number"
                    min={0}
                    max={120}
                    value={amcMonths}
                    onChange={(e) => setAmcMonths(e.target.value)}
                    className="mt-2 h-11 min-h-11"
                  />
                </div>
              ) : null}
            </section>

            {quoteStatus === "quote_approved" ? (
              <p className="text-body-sm text-on-surface-variant">
                Saving a correction withdraws Accounts approval. They must
                approve the new version before you can send it.
              </p>
            ) : null}

            <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-card shadow-card p-4">
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
                <span className="text-on-surface-variant">GST</span>
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
              <FormError>
                {state.error}
              </FormError>
            ) : null}

            <div className="mt-3 flex w-full flex-col gap-3">
              <Button
                type="submit"
                name="intent"
                value="draft"
                variant="bordered"
                size="lg"
                className="w-full justify-center text-center"
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
                className="w-full justify-center text-center"
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

        {activeStep === 2 ? (
          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-outline-variant bg-card px-4 py-3 md:static md:mx-0 md:rounded-2xl md:border">
            <Button
              type="button"
              size="lg"
              className="w-full justify-center text-center md:ml-auto md:w-auto md:min-w-[8.5rem]"
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
