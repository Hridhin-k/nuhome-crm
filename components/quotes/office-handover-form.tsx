"use client";

import { useActionState } from "react";
import {
  handOverOfficeAction,
  voidOfficeHandoverAction,
  type StockActionState,
} from "@/app/actions/stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatInrExact } from "@/lib/format/money";
import { FormError } from "@/components/app/form-error";
import { NativeSelect } from "@/components/ui/native-select";

export function OfficeHandoverForm({
  quoteId,
  amountDue,
  canVoid,
}: {
  quoteId: string;
  amountDue: number;
  canVoid: boolean;
}) {
  const [handover, handOver, handing] = useActionState<StockActionState, FormData>(
    handOverOfficeAction,
    {},
  );
  const [voided, voidHandover, voiding] = useActionState<StockActionState, FormData>(
    voidOfficeHandoverAction,
    {},
  );

  return (
    <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
      <h2 className="text-subheading text-on-surface">Office stock</h2>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Collect payment and hand over the shelf lines now. Lines that still need a vendor stay on this job.
      </p>
      {amountDue > 0 ? (
        <form action={handOver} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="hidden" name="quote_id" value={quoteId} />
          {handover.error ? (
            <FormError className="sm:col-span-2">{handover.error}</FormError>
          ) : null}
          <div>
            <Label htmlFor="amount">Amount collected</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={amountDue}
              step="0.01"
              required
              defaultValue={amountDue}
              className="mt-1 h-11"
            />
            <p className="mt-1 text-xs text-on-surface-variant">
              Shelf lines total {formatInrExact(amountDue)}
            </p>
          </div>
          <div>
            <Label htmlFor="method">Method</Label>
            <NativeSelect
              id="method"
              name="method"
              defaultValue="upi"
              wrapperClassName="mt-1 w-full"
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" name="reference" className="mt-1 h-11" placeholder="UTR, cheque, or leave blank for cash" />
          </div>
          <Button type="submit" disabled={handing} className="sm:col-span-2">
            {handing ? "Handing over…" : "Take payment and hand over"}
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-on-surface-variant">Shelf lines on this job have already been handed over.</p>
      )}
      {canVoid ? (
        <form action={voidHandover} className="mt-4 flex flex-col gap-2 border-t border-surface-variant pt-4">
          <input type="hidden" name="quote_id" value={quoteId} />
          {voided.error ? <FormError>{voided.error}</FormError> : null}
          <Label htmlFor="void-reason">Void today’s handover</Label>
          <Input id="void-reason" name="reason" required placeholder="Reason" className="h-11" />
          <Button type="submit" variant="bordered" disabled={voiding}>
            {voiding ? "Voiding…" : "Void handover"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
