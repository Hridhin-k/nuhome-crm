"use client";

import { useActionState, useState } from "react";
import { receiveStockAction, type StockActionState } from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/app/form-error";

type Line = {
  id: string;
  description: string;
  quantity: number;
  quantity_received: number;
};

export function ReceiveForm({
  purchaseId,
  lines,
}: {
  purchaseId: string;
  lines: Line[];
}) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      lines.map((line) => [line.id, Math.max(0, line.quantity - line.quantity_received)]),
    ),
  );
  const [state, action, pending] = useActionState<StockActionState, FormData>(
    receiveStockAction,
    {},
  );
  const payload = {
    purchase_id: purchaseId,
    items: lines.map((line) => ({
      stock_purchase_item_id: line.id,
      quantity: Number(qty[line.id] ?? 0),
    })),
  };

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      {state.error ? (
        <FormError>{state.error}</FormError>
      ) : null}
      <ul className="flex flex-col gap-3">
        {lines.map((line) => {
          const open = Math.max(0, line.quantity - line.quantity_received);
          return (
            <li key={line.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{line.description}</p>
                <p className="text-xs text-on-surface-variant">
                  {line.quantity_received}/{line.quantity} received
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={open}
                className="h-11 w-24"
                aria-label={`Receive ${line.description}`}
                value={qty[line.id] ?? 0}
                disabled={open === 0}
                onChange={(event) =>
                  setQty((current) => ({
                    ...current,
                    [line.id]: Number(event.target.value),
                  }))
                }
              />
            </li>
          );
        })}
      </ul>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Receive into office"}
      </Button>
    </form>
  );
}
