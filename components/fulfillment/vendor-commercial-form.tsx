"use client";

import { useActionState, useState } from "react";
import {
  confirmVendorSendAction,
  decideVendorQuoteAction,
  recordVendorPaymentAction,
  saveVendorQuoteAction,
  type ActionState,
} from "@/app/actions/workflow";
import { ConfirmActionSheet } from "@/components/app/confirm-action-sheet";
import { rememberFulfillmentScroll } from "@/components/app/scroll-to-focus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QuoteLinesTable } from "@/components/quotes/quote-lines-table";
import { formatInrExact } from "@/lib/format/money";
import { vendorPaymentReferenceRequired } from "@/lib/payments/reference";

const METHODS = [
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
] as const;

export function VendorCommercialForm({
  orderId,
  vendorOrderId,
  quoteRef,
  quoteAmount,
  billRef,
  billAmount,
  commercialStatus,
  physicalStatus,
  quoteRejectionReason,
  canSend,
  canApproveQuote,
  paidAmount,
  paidReference,
  paidMethod,
  lines,
  quoteNotes,
}: {
  orderId: string;
  vendorOrderId: string;
  quoteRef?: string | null;
  quoteAmount?: number | string | null;
  billRef?: string | null;
  billAmount?: number | string | null;
  commercialStatus?: string | null;
  physicalStatus: string;
  quoteRejectionReason?: string | null;
  canSend: boolean;
  canApproveQuote: boolean;
  paidAmount?: number | string | null;
  paidReference?: string | null;
  paidMethod?: string | null;
  lines: {
    description: string;
    item_code?: string | null;
    specification?: string | null;
    quantity: number;
  }[];
  quoteNotes?: string | null;
}) {
  const [quoteState, quoteAction, quoting] = useActionState<ActionState, FormData>(
    saveVendorQuoteAction,
    {},
  );
  const [decideState, decideAction, deciding] = useActionState<
    ActionState,
    FormData
  >(decideVendorQuoteAction, {});
  const [payState, payAction, paying] = useActionState<ActionState, FormData>(
    recordVendorPaymentAction,
    {},
  );
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("upi");
  const draft = physicalStatus === "draft";
  const commercial = commercialStatus ?? "pending_quote";
  const needsQuote = draft && (commercial === "pending_quote" || commercial === "quote_rejected");
  const waitingDecision = draft && commercial === "quoted";
  const canConfirm = draft && commercial === "quote_approved" && canSend;
  const sent = physicalStatus !== "draft";
  const vendorPaid = commercial === "vendor_paid" || paidAmount != null;
  const needsReference = vendorPaymentReferenceRequired(method, 1);

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-outline-variant bg-surface p-3">
      <p className="text-label-caps text-secondary">
        Vendor quote · Accounts verifies · {vendorPaid ? "vendor paid" : commercial}
      </p>
      {quoteRejectionReason ? (
        <p className="text-sm text-destructive">{quoteRejectionReason}</p>
      ) : null}

      {lines.length > 0 ? (
        <div className="overflow-x-auto">
          <QuoteLinesTable items={lines} showAmount={false} />
        </div>
      ) : null}
      {quoteNotes ? (
        <p className="text-sm text-on-surface-variant">
          <span className="font-medium text-on-surface">Quote notes.</span> {quoteNotes}
        </p>
      ) : null}

      {needsQuote && canSend ? (
        <form
          action={quoteAction}
          onSubmit={rememberFulfillmentScroll}
          className="grid gap-2"
        >
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="vendor_order_id" value={vendorOrderId} />
          <Label>Vendor quote ref</Label>
          <Input name="quote_ref" defaultValue={quoteRef ?? ""} required className="h-11 min-h-11" />
          <Label>Vendor quote amount</Label>
          <Input
            name="quote_amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            required
            min="0.01"
            defaultValue={quoteAmount ? String(quoteAmount) : ""}
            className="h-11 min-h-11"
          />
          <Button type="submit" disabled={quoting} className="min-h-11">
            {quoting ? "Saving…" : "Send quote to Accounts"}
          </Button>
          {quoteState.error ? (
            <p className="text-sm text-destructive">{quoteState.error}</p>
          ) : null}
        </form>
      ) : null}

      {waitingDecision && canApproveQuote ? (
        <form
          action={decideAction}
          onSubmit={rememberFulfillmentScroll}
          className="grid gap-2"
        >
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="vendor_order_id" value={vendorOrderId} />
          <Label>Return reason (if sending back)</Label>
          <Input name="reason" className="h-11 min-h-11" />
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="submit"
              name="decision"
              value="approve"
              disabled={deciding}
              className="min-h-11"
            >
              Verify quote
            </Button>
            <Button
              type="submit"
              name="decision"
              value="reject"
              variant="outline"
              disabled={deciding}
              className="min-h-11"
            >
              Return quote
            </Button>
          </div>
          {decideState.error ? (
            <p className="text-sm text-destructive">{decideState.error}</p>
          ) : null}
        </form>
      ) : null}

      {canConfirm ? (
        <ConfirmActionSheet
          title="Confirm send"
          description="This batch goes to the vendor after the quote was approved."
          triggerLabel="Confirm send"
          confirmLabel="Send to vendor"
          action={confirmVendorSendAction.bind(null, vendorOrderId, orderId)}
          onSubmit={rememberFulfillmentScroll}
        />
      ) : null}

      {sent ? (
        <>
          {vendorPaid ? (
            <p className="rounded-lg border border-emerald-700/30 bg-emerald-950/40 px-3 py-2 text-sm font-medium text-emerald-300">
              Vendor paid
              {paidAmount != null ? ` · ${formatInrExact(Number(paidAmount))}` : ""}
              {paidMethod ? ` · ${paidMethod}` : ""}
              {paidReference ? ` · ${paidReference}` : ""}
              {billRef ? ` · bill ${billRef}` : ""}
            </p>
          ) : (
            <form
              action={payAction}
              onSubmit={rememberFulfillmentScroll}
              className="grid gap-2"
            >
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="vendor_order_id" value={vendorOrderId} />
              <Label>Vendor bill ref</Label>
              <Input
                name="bill_ref"
                defaultValue={billRef ?? ""}
                required
                placeholder="Vendor invoice / bill number"
                className="h-11 min-h-11"
              />
              <Label>Pay vendor</Label>
              <Input
                name="amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                min="0.01"
                required
                defaultValue={billAmount ? String(billAmount) : quoteAmount ? String(quoteAmount) : ""}
                className="h-11 min-h-11"
              />
              <Label htmlFor={`method-${vendorOrderId}`}>Method</Label>
              <select
                id={`method-${vendorOrderId}`}
                name="method"
                value={method}
                onChange={(e) =>
                  setMethod(e.target.value as (typeof METHODS)[number]["value"])
                }
                className="h-11 min-h-11 rounded-lg border border-outline-variant bg-surface px-3 text-on-surface"
              >
                {METHODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {method === "other" ? (
                <>
                  <Label htmlFor={`method-other-${vendorOrderId}`}>
                    Describe method
                  </Label>
                  <Input
                    id={`method-other-${vendorOrderId}`}
                    name="reference"
                    required
                    placeholder="How was the vendor paid?"
                    className="h-11 min-h-11"
                  />
                </>
              ) : (
                <>
                  <Label htmlFor={`ref-${vendorOrderId}`}>
                    {needsReference
                      ? "UTR / cheque (required)"
                      : "UTR / cheque (optional)"}
                  </Label>
                  <Input
                    id={`ref-${vendorOrderId}`}
                    name="reference"
                    required={needsReference}
                    placeholder="UTR / cheque"
                    className="h-11 min-h-11"
                  />
                </>
              )}
              <Button type="submit" variant="outline" disabled={paying} className="min-h-11">
                {paying ? "Recording…" : "Mark vendor paid"}
              </Button>
              {payState.error ? (
                <p className="text-sm text-destructive">{payState.error}</p>
              ) : null}
            </form>
          )}
        </>
      ) : null}
    </div>
  );
}
