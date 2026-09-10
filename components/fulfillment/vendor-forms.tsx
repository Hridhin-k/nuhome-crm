"use client";

import { useActionState, useState } from "react";
import {
  receiveAction,
  sendToVendorAction,
  writeOffItemsAction,
  type ActionState,
} from "@/app/actions/workflow";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/app/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  WRITE_OFF_LABELS,
  WRITE_OFF_REASONS,
  type WriteOffReason,
} from "@/lib/workflow/fulfillment";

export function SendToVendorForm({
  orderId,
  orderNumber,
  vendors,
  items,
}: {
  orderId: string;
  orderNumber: string;
  vendors: { id: string; name: string }[];
  items: {
    id: string;
    description: string;
    available: number;
    unit_cost?: number;
  }[];
}) {
  const sendable = items.filter((item) => item.available > 0);
  const defaultVendor = vendors[0]?.id ?? "";
  const [vendorByItem, setVendorByItem] = useState<Record<string, string>>(() =>
    Object.fromEntries(sendable.map((item) => [item.id, defaultVendor])),
  );
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(sendable.map((item) => [item.id, Math.floor(item.available)])),
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    sendToVendorAction,
    {},
  );
  const payload = sendable
    .map((item) => {
      const vendorId = vendorByItem[item.id] ?? defaultVendor;
      const vendor = vendors.find((row) => row.id === vendorId);
      return {
        order_item_id: item.id,
        vendor_id: vendorId,
        vendor_name: vendor?.name,
        quantity: Number(qty[item.id] ?? 0),
        unit_cost: item.unit_cost ?? 0,
      };
    })
    .filter((row) => row.quantity > 0 && row.vendor_id);
  const vendorCount = new Set(payload.map((row) => row.vendor_id)).size;

  if (sendable.length === 0) {
    return null;
  }

  return (
    <FormSheet
      title="Send to vendors"
      description="Qty is filled. Change the vendor on a line to split the job. Accounts verifies each vendor quote before send."
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-subheading text-on-primary">
          Allocate to vendor
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="order_number" value={orderNumber} />
        <input type="hidden" name="items" value={JSON.stringify(payload)} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="expected_delivery">Expected delivery</Label>
          <input
            id="expected_delivery"
            name="expected_delivery"
            type="date"
            className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
          />
          <p className="text-xs text-on-surface-variant">
            Used for overdue flags. Same date is applied to every vendor batch.
          </p>
          <ul className="divide-y divide-surface-variant rounded-lg border border-surface-variant">
            {sendable.map((item) => (
              <li key={item.id} className="flex min-w-0 flex-col gap-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-on-surface-variant">
                      Unsent {item.available}
                    </p>
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={Math.floor(item.available)}
                    step={1}
                    className="h-10 w-20 shrink-0"
                    value={qty[item.id] ?? 0}
                    onChange={(e) => {
                      const next = Math.trunc(Number(e.target.value));
                      setQty((current) => ({
                        ...current,
                        [item.id]: Number.isFinite(next)
                          ? Math.max(0, Math.min(Math.floor(item.available), next))
                          : 0,
                      }));
                    }}
                  />
                </div>
                <select
                  value={vendorByItem[item.id] ?? defaultVendor}
                  onChange={(e) =>
                    setVendorByItem((current) => ({
                      ...current,
                      [item.id]: e.target.value,
                    }))
                  }
                  className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
                >
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          <p className="text-sm text-on-surface-variant">
            {vendorCount <= 1
              ? "One vendor quote will be created for Accounts to verify."
              : `${vendorCount} vendor quotes will be created and split automatically.`}
          </p>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="submit"
            disabled={pending || vendors.length === 0 || payload.length === 0}
            size="lg"
            className="w-full"
          >
            {pending ? "Saving…" : "Save vendor split"}
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
    order_item_id: string;
    description: string;
    remaining: number;
  }[];
}) {
  const open = items.filter((item) => item.remaining > 0);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      open.map((item) => [item.order_item_id, Math.floor(item.remaining)]),
    ),
  );
  const [state, action, pending] = useActionState<ActionState, FormData>(
    receiveAction,
    {},
  );
  const payload = open
    .map((item) => ({
      order_item_id: item.order_item_id,
      quantity: Math.trunc(Number(qty[item.order_item_id] ?? 0)),
    }))
    .filter((row) => row.quantity > 0);

  if (open.length === 0) {
    return null;
  }

  return (
    <FormSheet
      title="Record items received"
      description="Type what actually arrived. Leave a line at 0 if it is still outstanding, then close shortage separately."
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-subheading text-on-primary">
          Record items received
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="vendor_order_id" value={vendorOrderId} />
        <input type="hidden" name="received" value={JSON.stringify(payload)} />
        <FormSheetBody className="flex flex-col gap-3">
          <ul className="divide-y divide-surface-variant rounded-lg border border-surface-variant">
            {open.map((item) => (
              <li
                key={item.order_item_id}
                className="flex min-w-0 items-center gap-2 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-on-surface-variant">
                    Still owed {item.remaining}
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={Math.floor(item.remaining)}
                  step={1}
                  className="h-10 w-20 shrink-0"
                  value={qty[item.order_item_id] ?? 0}
                  onChange={(e) => {
                    const next = Math.trunc(Number(e.target.value));
                    setQty((current) => ({
                      ...current,
                      [item.order_item_id]: Number.isFinite(next)
                        ? Math.max(
                            0,
                            Math.min(Math.floor(item.remaining), next),
                          )
                        : 0,
                    }));
                  }}
                />
              </li>
            ))}
          </ul>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="submit"
            disabled={pending || payload.length === 0}
            size="lg"
            className="w-full"
          >
            {pending ? "Saving…" : "Record items received"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}

export function WriteOffItemsForm({
  orderId,
  items,
}: {
  orderId: string;
  items: {
    id: string;
    description: string;
    remaining: number;
  }[];
}) {
  const open = items.filter((item) => item.remaining > 0);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(open.map((item) => [item.id, 0])),
  );
  const [reason, setReason] = useState<WriteOffReason>("shortage");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    writeOffItemsAction,
    {},
  );
  const payload = open
    .map((item) => ({
      order_item_id: item.id,
      quantity: Number(qty[item.id] ?? 0),
      reason,
    }))
    .filter((row) => row.quantity > 0);

  if (open.length === 0) {
    return null;
  }

  return (
    <FormSheet
      title="Close shortage / damage / return"
      description="Use this when the remaining quantity will not arrive. Delivery can proceed once every line is received or closed."
      trigger={
        <span className="inline-flex h-11 min-h-11 w-full items-center justify-center rounded-lg border border-outline-variant bg-transparent px-4 text-subheading text-on-surface">
          Close remainder
        </span>
      }
    >
      <form action={action} className="flex min-h-0 flex-1 flex-col">
        <input type="hidden" name="order_id" value={orderId} />
        <input type="hidden" name="items" value={JSON.stringify(payload)} />
        <FormSheetBody className="flex flex-col gap-3">
          <Label htmlFor="write-off-reason">Reason</Label>
          <select
            id="write-off-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as WriteOffReason)}
            className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
          >
            {WRITE_OFF_REASONS.map((value) => (
              <option key={value} value={value}>
                {WRITE_OFF_LABELS[value]}
              </option>
            ))}
          </select>
          <ul className="divide-y divide-surface-variant rounded-lg border border-surface-variant">
            {open.map((item) => (
              <li key={item.id} className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-on-surface-variant">
                    Unaccounted {item.remaining}
                  </p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={Math.floor(item.remaining)}
                  step={1}
                  className="h-10 w-20 shrink-0"
                  value={qty[item.id] ?? 0}
                  onChange={(e) => {
                    const next = Math.trunc(Number(e.target.value));
                    setQty((current) => ({
                      ...current,
                      [item.id]: Number.isFinite(next)
                        ? Math.max(0, Math.min(Math.floor(item.remaining), next))
                        : 0,
                    }));
                  }}
                />
              </li>
            ))}
          </ul>
          <Label htmlFor="write-off-notes">Notes (optional)</Label>
          <Textarea id="write-off-notes" name="notes" rows={2} />
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="submit"
            disabled={pending || payload.length === 0}
            size="lg"
            className="w-full"
          >
            {pending ? "Saving…" : "Close remainder"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
