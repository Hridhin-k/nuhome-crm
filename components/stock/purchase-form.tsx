"use client";

import { useActionState, useMemo, useState } from "react";
import { createStockPurchaseAction, type StockActionState } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Material = { id: string; name: string; sku: string | null; default_cost: number | string };
type Vendor = { id: string; name: string };

type Line = { key: string; material_id: string; quantity: number; unit_cost: number };

export function PurchaseForm({
  vendors,
  materials,
}: {
  vendors: Vendor[];
  materials: Material[];
}) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      key: "line-1",
      material_id: materials[0]?.id ?? "",
      quantity: 1,
      unit_cost: Number(materials[0]?.default_cost ?? 0),
    },
  ]);
  const [state, action, pending] = useActionState<StockActionState, FormData>(
    createStockPurchaseAction,
    {},
  );

  const payload = useMemo(
    () => ({
      vendor_id: vendorId,
      notes: notes || undefined,
      items: lines
        .filter((line) => line.material_id)
        .map((line) => {
          const material = materials.find((row) => row.id === line.material_id);
          return {
            material_id: line.material_id,
            description: material?.name ?? "Material",
            quantity: line.quantity,
            unit_cost: line.unit_cost,
          };
        }),
    }),
    [vendorId, notes, lines, materials],
  );

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.material_id) {
          const material = materials.find((row) => row.id === patch.material_id);
          next.unit_cost = Number(material?.default_cost ?? next.unit_cost);
        }
        return next;
      }),
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {state.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div>
        <Label htmlFor="vendor">Vendor</Label>
        <select
          id="vendor"
          className="mt-1 h-11 w-full rounded-xl border border-outline-variant bg-card px-3 text-sm"
          value={vendorId}
          onChange={(event) => setVendorId(event.target.value)}
        >
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </div>
      <ul className="flex flex-col gap-3">
        {lines.map((line, index) => (
          <li key={line.key} className="grid grid-cols-1 gap-2 rounded-lg border border-outline-variant p-3 sm:grid-cols-[1fr_6rem_7rem]">
            <div>
              <Label>Material</Label>
              <select
                className="mt-1 h-11 w-full rounded-xl border border-outline-variant bg-card px-3 text-sm"
                value={line.material_id}
                onChange={(event) => updateLine(line.key, { material_id: event.target.value })}
                aria-label={`Material ${index + 1}`}
              >
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.sku ? `${material.sku} · ` : ""}
                    {material.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Qty</Label>
              <Input
                type="number"
                min={1}
                className="mt-1 h-11"
                value={line.quantity}
                onChange={(event) =>
                  updateLine(line.key, { quantity: Number(event.target.value) })
                }
              />
            </div>
            <div>
              <Label>Cost</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="mt-1 h-11"
                value={line.unit_cost}
                onChange={(event) =>
                  updateLine(line.key, { unit_cost: Number(event.target.value) })
                }
              />
            </div>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="bordered"
        onClick={() =>
          setLines((current) => [
            ...current,
            {
              key: crypto.randomUUID(),
              material_id: materials[0]?.id ?? "",
              quantity: 1,
              unit_cost: Number(materials[0]?.default_cost ?? 0),
            },
          ])
        }
      >
        Add material
      </Button>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          className="mt-1 h-11"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending || lines.length === 0}>
        {pending ? "Sending…" : "Send to vendor"}
      </Button>
    </form>
  );
}
