"use client";

import { useActionState } from "react";
import { createMaterialAction, type AdminActionState } from "@/app/actions/admin";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MaterialForm({
  categories,
  material,
}: {
  categories: { id: string; name: string }[];
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
    isActive: boolean;
  };
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    createMaterialAction,
    {},
  );
  const editing = Boolean(material);
  const suffix = material?.id ?? "new";

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
