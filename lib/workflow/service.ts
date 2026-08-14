import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  completeDeliverySchema,
  createQuoteSchema,
  receiveItemsSchema,
  recordPaymentSchema,
  rejectPaymentSchema,
  rejectQuoteSchema,
  reviseQuoteSchema,
  sendToVendorSchema,
  writeOffItemsSchema,
} from "@/lib/validation/workflow";
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
  });
  throwIfError(error);
  return data;
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
  const { data, error } = await supabase.rpc("send_order_to_vendor", {
    p_order_id: parsed.order_id,
    p_vendor_id: parsed.vendor_id,
    p_items: parsed.items,
    p_expected_delivery: parsed.expected_delivery,
  });
  throwIfError(error);
  return data;
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

export async function getOrderBalance(orderId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("order_balance", {
    p_order_id: orderId,
  });
  throwIfError(error);
  return data;
}
