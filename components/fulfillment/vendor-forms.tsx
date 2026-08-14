"use client";

import { useActionState } from "react";
import {
  receiveAction,
  sendToVendorAction,
  type ActionState,
} from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SendToVendorForm({
  orderId,
  vendors,
  items,
}: {
  orderId: string;
  vendors: { id: string; name: string }[];
  items: { id: string; description: string; quantity: number }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    sendToVendorAction,
    {},
  );
  const payload = items.map((item) => ({
    order_item_id: item.id,
    quantity: Number(item.quantity),
  }));

  return (
    <FormSheet
      title="Send to vendor"
      description="Choose a vendor and expected delivery."
      trigger={
        <span className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary">
          Send to vendor
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="items" value={JSON.stringify(payload)} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="vendor_id">Vendor</Label>
          <select
            id="vendor_id"
            name="vendor_id"
            required
            className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <Label htmlFor="expected_delivery">Expected delivery</Label>
          <input
            id="expected_delivery"
            name="expected_delivery"
            type="date"
            className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
          />
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="submit"
            disabled={pending || vendors.length === 0}
            size="lg"
            className="w-full"
          >
            {pending ? "Sending…" : "Send to vendor"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}

export function ReceiveItemsForm({
  orderId,
  vendorOrderId,
  items,
}: {
  orderId: string;
  vendorOrderId: string;
  items: {
    id: string;
    description: string;
    quantity: number;
    quantity_received: number;
  }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    receiveAction,
    {},
  );
  const received = items.map((item) => ({
    order_item_id: item.id,
    quantity: Math.max(
      0,
      Number(item.quantity) - Number(item.quantity_received),
    ),
  }));

  return (
    <FormSheet
      title="Record items received"
      description="Remaining quantities will be marked received."
      trigger={
        <span className="inline-flex h-12 min-h-12 w-full items-center justify-center rounded-lg bg-primary px-6 text-[15px] font-medium text-on-primary">
          Record items received
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="vendor_order_id" value={vendorOrderId} />
        <input type="hidden" name="received" value={JSON.stringify(received)} />
        <FormSheetBody className="flex flex-col gap-3">
          <ul className="divide-y divide-surface-variant rounded-lg border border-surface-variant">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex justify-between px-4 py-3 text-sm"
              >
                <span>{item.description}</span>
                <span className="text-on-surface-variant">
                  {item.quantity_received}/{item.quantity}
                </span>
              </li>
            ))}
          </ul>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="submit" disabled={pending} size="lg" className="w-full">
            {pending ? "Saving…" : "Record items received"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
