"use client";

import { useActionState, useState } from "react";
import { createMaterialAction, type AdminActionState } from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type VendorRow = {
  key: string;
  vendorId: string;
  newName: string;
  unitCost: string;
  preferred: boolean;
};

function startingVendorRows(
  links: { vendorId: string; unitCost: number; preferred: boolean }[] | undefined,
): VendorRow[] {
  if (!links?.length) {
    return [
      { key: "first", vendorId: "", newName: "", unitCost: "", preferred: true },
    ];
  }
  return links.map((link) => ({
    key: link.vendorId,
    vendorId: link.vendorId,
    newName: "",
    unitCost: String(link.unitCost),
    preferred: link.preferred,
  }));
}

export function MaterialForm({
  categories,
  vendors,
  material,
}: {
  categories: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  material?: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    categoryName: string;
    sellPrice: number;
    cost: number;
    hsnCode?: string | null;
    gstRate?: number;
    warrantyMonths?: number;
    description?: string | null;
    isActive: boolean;
    officeQuantity?: number;
    officeReserved?: number;
    vendorLinks?: { vendorId: string; unitCost: number; preferred: boolean }[];
  };
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    createMaterialAction,
    {},
  );
  const editing = Boolean(material);
  const suffix = material?.id ?? "new";
  const [vendorRows, setVendorRows] = useState(() =>
    startingVendorRows(material?.vendorLinks),
  );
  const vendorPayload = vendorRows.map((row) => ({
    vendor_id: row.vendorId && row.vendorId !== "__new__" ? row.vendorId : "",
    vendor_name: row.vendorId === "__new__" ? row.newName : "",
    unit_cost: Number(row.unitCost || 0),
    is_preferred: row.preferred,
  }));
  const takenVendorIds = new Set(
    vendorRows
      .map((row) => row.vendorId)
      .filter((id) => id && id !== "__new__"),
  );

  return (
    <FormSheet
      title={editing ? "Edit material" : "Add material"}
      description="Used in the walk-in quote builder. Category is created if it does not exist."
      triggerClassName={editing ? "w-auto" : undefined}
      trigger={
        <span
          className={
            editing
              ? "inline-flex h-9 items-center rounded-lg border border-outline-variant px-3 text-xs font-semibold tracking-[0.05em] text-primary uppercase"
              : "inline-flex h-11 min-h-11 items-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary"
          }
        >
          {editing ? "Edit" : "Add material"}
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        {material ? <input type="hidden" name="id" value={material.id} /> : null}
        <input type="hidden" name="vendors" value={JSON.stringify(vendorPayload)} />
        <FormSheetBody className="flex flex-col gap-3">
          <div>
            <Label htmlFor={`name-${suffix}`}>Name</Label>
            <Input
              id={`name-${suffix}`}
              name="name"
              required
              defaultValue={material?.name}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor={`sku-${suffix}`}>SKU</Label>
            <Input
              id={`sku-${suffix}`}
              name="sku"
              required
              defaultValue={material?.sku ?? ""}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor={`category-${suffix}`}>Category</Label>
            <Input
              id={`category-${suffix}`}
              name="category"
              required
              list={`material-categories-${suffix}`}
              placeholder="Modular Kitchen"
              defaultValue={material?.categoryName}
              className="mt-2 h-11 min-h-11"
            />
            <datalist id={`material-categories-${suffix}`}>
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor={`unit-${suffix}`}>Unit</Label>
            <Input
              id={`unit-${suffix}`}
              name="unit"
              defaultValue={material?.unit ?? "pcs"}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div>
            <Label htmlFor={`office-${suffix}`}>Quantity at office</Label>
            <p className="mt-1 text-xs text-on-surface-variant">
              Already at the firm. 0 means order this only when a customer wants it.
              {material && Number(material.officeReserved) > 0
                ? ` ${Number(material.officeReserved)} are reserved on open quotes.`
                : ""}
            </p>
            <Input
              id={`office-${suffix}`}
              name="office_quantity"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              defaultValue={String(material?.officeQuantity ?? 0)}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`sell_price-${suffix}`}>Sell price</Label>
              <Input
                id={`sell_price-${suffix}`}
                name="sell_price"
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue={material ? String(material.sellPrice) : "0"}
                className="mt-2 h-11 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor={`cost-${suffix}`}>Cost</Label>
              <Input
                id={`cost-${suffix}`}
                name="cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue={material ? String(material.cost) : "0"}
                className="mt-2 h-11 min-h-11"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`hsn-${suffix}`}>HSN</Label>
              <Input
                id={`hsn-${suffix}`}
                name="hsn_code"
                maxLength={8}
                defaultValue={material?.hsnCode ?? ""}
                className="mt-2 h-11 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor={`gst-${suffix}`}>GST %</Label>
              <p className="mt-1 text-xs text-on-surface-variant">
                Sales cannot change this on a quote.
              </p>
              <Input
                id={`gst-${suffix}`}
                name="gst_rate"
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue={String(material?.gstRate ?? 18)}
                className="mt-2 h-11 min-h-11"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`description-${suffix}`}>Description</Label>
            <p className="mt-1 text-xs text-on-surface-variant">
              Shown on the ⓘ button when Sales adds this item to a quote.
            </p>
            <Textarea
              id={`description-${suffix}`}
              name="description"
              rows={3}
              defaultValue={material?.description ?? ""}
              className="mt-2"
              placeholder="e.g. 600mm base with soft-close hinges"
            />
          </div>
          <div>
            <Label htmlFor={`warranty-${suffix}`}>Warranty (months)</Label>
            <Input
              id={`warranty-${suffix}`}
              name="warranty_months"
              type="number"
              inputMode="numeric"
              defaultValue={String(material?.warrantyMonths ?? 12)}
              className="mt-2 h-11 min-h-11"
            />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-outline-variant p-3">
            <div>
              <p className="text-sm font-medium text-on-surface">Vendors</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Who supplies this. Add every vendor, with the price they charge. Mark one as the usual supplier.
              </p>
            </div>
            {vendorRows.map((row) => (
              <div key={row.key} className="flex flex-col gap-2 border-t border-surface-variant pt-3">
                <Label htmlFor={`vendor-${suffix}-${row.key}`}>Vendor</Label>
                <select
                  id={`vendor-${suffix}-${row.key}`}
                  value={row.vendorId}
                  onChange={(event) =>
                    setVendorRows((current) =>
                      current.map((entry) =>
                        entry.key === row.key
                          ? { ...entry, vendorId: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  className="h-11 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3"
                >
                  <option value="">Choose a vendor</option>
                  {vendors
                    .filter((vendor) => vendor.id === row.vendorId || !takenVendorIds.has(vendor.id))
                    .map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </option>
                    ))}
                  <option value="__new__">New vendor</option>
                </select>
                {row.vendorId === "__new__" ? (
                  <Input
                    value={row.newName}
                    placeholder="Vendor name"
                    onChange={(event) =>
                      setVendorRows((current) =>
                        current.map((entry) =>
                          entry.key === row.key
                            ? { ...entry, newName: event.target.value }
                            : entry,
                        ),
                      )
                    }
                    className="h-11 min-h-11"
                  />
                ) : null}
                <Label htmlFor={`vendor-price-${suffix}-${row.key}`}>Their price</Label>
                <Input
                  id={`vendor-price-${suffix}-${row.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={row.unitCost}
                  onChange={(event) =>
                    setVendorRows((current) =>
                      current.map((entry) =>
                        entry.key === row.key
                          ? { ...entry, unitCost: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  className="h-11 min-h-11"
                />
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary"
                    onClick={() =>
                      setVendorRows((current) =>
                        current.map((entry) => ({
                          ...entry,
                          preferred: entry.key === row.key,
                        })),
                      )
                    }
                  >
                    {row.preferred ? "Usual supplier" : "Make usual supplier"}
                  </button>
                  {vendorRows.length > 1 ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-on-surface-variant"
                      onClick={() =>
                        setVendorRows((current) => {
                          const next = current.filter((entry) => entry.key !== row.key);
                          if (!next.some((entry) => entry.preferred) && next[0]) {
                            next[0] = { ...next[0], preferred: true };
                          }
                          return next;
                        })
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-semibold text-primary"
              onClick={() =>
                setVendorRows((current) => [
                  ...current,
                  {
                    key: crypto.randomUUID(),
                    vendorId: "",
                    newName: "",
                    unitCost: "",
                    preferred: false,
                  },
                ])
              }
            >
              Add another vendor
            </button>
          </div>
          {editing ? (
            <div>
              <Label htmlFor={`active-${suffix}`}>Status</Label>
              <select
                id={`active-${suffix}`}
                name="is_active"
                defaultValue={material?.isActive ? "true" : "false"}
                className="mt-2 h-11 min-h-11 w-full rounded-lg border border-outline-variant bg-surface px-3"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          ) : null}
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Save material"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
