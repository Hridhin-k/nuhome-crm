import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  cancelJobSchema,
  completeDeliverySchema,
  createQuoteSchema,
  receiveItemsSchema,
  recordPaymentSchema,
  rejectPaymentSchema,
  rejectQuoteSchema,
  reviseQuoteSchema,
  decideVendorQuoteSchema,
  saveVendorQuoteSchema,
  allocateVendorsSchema,
  sendToVendorSchema,
  writeOffItemsSchema,
} from "@/lib/validation/workflow";
import { groupLinesByVendor, suggestedVendorQuoteRef } from "@/lib/workflow/vendor-split";
import { assertPaymentAmount } from "@/lib/workflow/engine";
import type { Database } from "@/types/database";

type WorkflowStatus = Database["public"]["Enums"]["workflow_status"];

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function createQuote(input: unknown) {
  const parsed = createQuoteSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_quote", {
    p_customer_id: parsed.customer_id,
    p_items: parsed.items,
    p_notes: parsed.notes,
    p_warranty_months: parsed.warranty_months ?? 12,
    p_include_amc: parsed.include_amc ?? false,
    p_amc_months: parsed.amc_months ?? 12,
  });
  throwIfError(error);
  return data as string;
}

export async function submitQuote(quoteId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("submit_quote", { p_quote_id: quoteId });
  throwIfError(error);
}

export async function approveQuote(quoteId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("approve_quote", { p_quote_id: quoteId });
  throwIfError(error);
}

export async function rejectQuote(input: unknown) {
  const parsed = rejectQuoteSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reject_quote", {
    p_quote_id: parsed.quote_id,
    p_reason: parsed.reason,
  });
  throwIfError(error);
}

export async function reviseQuote(input: unknown) {
  const parsed = reviseQuoteSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("revise_quote", {
    p_quote_id: parsed.quote_id,
    p_items: parsed.items,
    p_notes: parsed.notes,
    p_warranty_months: parsed.warranty_months ?? 12,
    p_include_amc: parsed.include_amc ?? false,
    p_amc_months: parsed.amc_months ?? 12,
  });
  throwIfError(error);
  return data;
}

export async function sendQuoteToCustomer(quoteId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("send_quote_to_customer", {
    p_quote_id: quoteId,
  });
  throwIfError(error);
  return data;
}

export async function recordPayment(input: unknown) {
  const parsed = recordPaymentSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  if (parsed.kind === "advance" || parsed.kind === "full") {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id")
      .eq("quote_id", parsed.quote_id)
      .maybeSingle();
    throwIfError(orderError);
    if (order?.id) {
      const balance = await getOrderBalance(order.id);
      const outstanding = Number(
        (balance as { outstanding?: number } | null)?.outstanding ?? 0,
      );
      assertPaymentAmount(parsed.kind, parsed.amount, outstanding);
    }
  }
  const { data, error } = await supabase.rpc("record_payment", {
    p_quote_id: parsed.quote_id,
    p_kind: parsed.kind,
    p_amount: parsed.amount,
    p_method: parsed.method,
    p_reference: parsed.reference,
    p_paid_at: parsed.paid_at,
    p_notes: parsed.notes,
  });
  throwIfError(error);
  return data;
}

export async function verifyPayment(paymentId: string, notes?: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("verify_payment", {
    p_payment_id: paymentId,
    p_notes: notes,
  });
  throwIfError(error);
  return data as WorkflowStatus;
}

export async function rejectPayment(input: unknown) {
  const parsed = rejectPaymentSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reject_payment", {
    p_payment_id: parsed.payment_id,
    p_notes: parsed.notes,
  });
  throwIfError(error);
}

export async function sendOrderToVendor(input: unknown) {
  const parsed = sendToVendorSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("allocate_vendor_order", {
    p_order_id: parsed.order_id,
    p_vendor_id: parsed.vendor_id,
    p_items: parsed.items,
    p_expected_delivery: parsed.expected_delivery,
  });
  throwIfError(error);
  return data;
}

export async function allocateVendors(input: unknown) {
  const parsed = allocateVendorsSchema.parse(input);
  const batches = groupLinesByVendor(parsed.items);
  if (batches.length === 0) {
    throw new Error("Select at least one item to send");
  }
  const names = new Map(
    parsed.items.map((item) => [item.vendor_id, item.vendor_name ?? "VENDOR"]),
  );
  const ids: string[] = [];
  for (const batch of batches) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("allocate_vendor_order", {
      p_order_id: parsed.order_id,
      p_vendor_id: batch.vendor_id,
      p_items: batch.items,
      p_expected_delivery: parsed.expected_delivery,
    });
    throwIfError(error);
    const vendorOrderId = data as string;
    ids.push(vendorOrderId);
    if (batch.quote_amount > 0) {
      await saveVendorQuote({
        vendor_order_id: vendorOrderId,
        quote_ref: suggestedVendorQuoteRef(
          parsed.order_number,
          names.get(batch.vendor_id) ?? "VENDOR",
        ),
        quote_amount: batch.quote_amount,
      });
    }
  }
  return ids;
}

export async function saveVendorQuote(input: unknown) {
  const parsed = saveVendorQuoteSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("save_vendor_quote", {
    p_vendor_order_id: parsed.vendor_order_id,
    p_quote_ref: parsed.quote_ref,
    p_quote_amount: parsed.quote_amount,
  });
  throwIfError(error);
}

export async function decideVendorQuote(input: unknown) {
  const parsed = decideVendorQuoteSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("decide_vendor_quote", {
    p_vendor_order_id: parsed.vendor_order_id,
    p_approve: parsed.approve,
    p_reason: parsed.reason,
  });
  throwIfError(error);
}

export async function confirmVendorSend(vendorOrderId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_vendor_send", {
    p_vendor_order_id: vendorOrderId,
  });
  throwIfError(error);
}

export async function markVendorDispatched(vendorOrderId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("mark_vendor_dispatched", {
    p_vendor_order_id: vendorOrderId,
  });
  throwIfError(error);
}

export async function recordItemsReceived(input: unknown) {
  const parsed = receiveItemsSchema.parse(input);
  const received = parsed.received.filter((row) => row.quantity > 0);
  if (received.length === 0) {
    throw new Error("Enter at least one received quantity");
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("record_items_received", {
    p_vendor_order_id: parsed.vendor_order_id,
    p_received: received,
  });
  throwIfError(error);
  return data as WorkflowStatus;
}

export async function writeOffItems(input: unknown) {
  const parsed = writeOffItemsSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("write_off_order_items", {
    p_order_id: parsed.order_id,
    p_items: parsed.items,
    p_notes: parsed.notes,
  });
  throwIfError(error);
  return data as WorkflowStatus;
}

export async function completeDelivery(input: unknown) {
  const parsed = completeDeliverySchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("complete_delivery", {
    p_order_id: parsed.order_id,
    p_notes: parsed.notes,
  });
  throwIfError(error);
}

export async function cancelJob(input: unknown) {
  const parsed = cancelJobSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_job", {
    p_quote_id: parsed.quote_id,
    p_reason: parsed.reason,
  });
  throwIfError(error);
}

export async function getOrderBalance(orderId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("order_balance", {
    p_order_id: orderId,
  });
  throwIfError(error);
  return data;
}

export async function requestCreditDelivery(orderId: string, notes?: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("request_credit_delivery", {
    p_order_id: orderId,
    p_notes: notes,
  });
  throwIfError(error);
}

export async function decideCreditDelivery(orderId: string, approve: boolean) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("decide_credit_delivery", {
    p_order_id: orderId,
    p_approve: approve,
  });
  throwIfError(error);
}

export async function saveVendorCommercial(input: {
  vendor_order_id: string;
  quote_ref?: string;
  quote_amount?: number;
  bill_ref?: string;
  bill_amount?: number;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("save_vendor_commercial", {
    p_vendor_order_id: input.vendor_order_id,
    p_quote_ref: input.quote_ref,
    p_quote_amount: input.quote_amount,
    p_bill_ref: input.bill_ref,
    p_bill_amount: input.bill_amount,
  });
  throwIfError(error);
}

export async function recordVendorPayment(input: {
  vendor_order_id: string;
  amount: number;
  method?: string;
  reference?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("record_vendor_payment", {
    p_vendor_order_id: input.vendor_order_id,
    p_amount: input.amount,
    p_method: input.method,
    p_reference: input.reference,
  });
  throwIfError(error);
}
