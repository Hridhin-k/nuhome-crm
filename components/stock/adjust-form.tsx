"use client";

import { useActionState } from "react";
import { adjustStockAction, type StockActionState } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/app/form-error";
import { NativeSelect } from "@/components/ui/native-select";

export function AdjustForm({
  materials,
}: {
  materials: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<StockActionState, FormData>(
    adjustStockAction,
    {},
  );

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem_1fr_auto] sm:items-end">
      {state.error ? (
        <FormError className="sm:col-span-4">{state.error}</FormError>
      ) : null}
      <div>
        <Label htmlFor="material_id">Material</Label>
        <NativeSelect
          id="material_id"
          name="material_id"
          wrapperClassName="mt-1 w-full"
          defaultValue={materials[0]?.id}
        >
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label htmlFor="delta">Change</Label>
        <Input id="delta" name="delta" type="number" step="1" required className="mt-1 h-11" placeholder="+2" />
      </div>
      <div>
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" name="reason" required className="mt-1 h-11" placeholder="Stocktake" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Adjust"}
      </Button>
    </form>
  );
}
