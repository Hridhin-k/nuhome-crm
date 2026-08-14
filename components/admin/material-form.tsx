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
}: {
  categories: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    createMaterialAction,
    {},
  );

  return (
    <FormSheet
      title="Add material"
      description="Used in the walk-in quote builder. Category is created if it does not exist."
      trigger={
        <span className="inline-flex h-11 min-h-11 items-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary">
          Add material
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <FormSheetBody className="flex flex-col gap-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required className="mt-2 h-11 min-h-11" />
          </div>
          <div>
            <Label htmlFor="sku">SKU</Label>
            <Input id="sku" name="sku" required className="mt-2 h-11 min-h-11" />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              required
              list="material-categories"
              placeholder="Modular Kitchen"
              className="mt-2 h-11 min-h-11"
            />
            <datalist id="material-categories">
              {categories.map((category) => (
                <option key={category.id} value={category.name} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" name="unit" defaultValue="pcs" className="mt-2 h-11 min-h-11" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sell_price">Sell price</Label>
              <Input
                id="sell_price"
                name="sell_price"
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue="0"
                className="mt-2 h-11 min-h-11"
              />
            </div>
            <div>
              <Label htmlFor="cost">Cost</Label>
              <Input
                id="cost"
                name="cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                defaultValue="0"
                className="mt-2 h-11 min-h-11"
              />
            </div>
          </div>
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
