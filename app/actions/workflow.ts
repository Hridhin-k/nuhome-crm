"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import { requirePermission } from "@/lib/auth/guards";
import {
  approveQuote,
  completeDelivery,
  createQuote,
  markVendorDispatched,
  recordItemsReceived,
  recordPayment,
  rejectQuote,
  reviseQuote,
  sendOrderToVendor,
  sendQuoteToCustomer,
  submitQuote,
  verifyPayment,
} from "@/lib/workflow/service";
import { createCustomerRow } from "@/lib/api/customers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation/workflow";

export type ActionState = { error?: string; notice?: string };

export async function createCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("customers.write");
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  try {
    const id = await createCustomerRow({
      ...parsed.data,
      createdBy: user.id,
    });
    revalidatePath("/customers");
    const returnTo = formData.get("returnTo");
    if (typeof returnTo === "string" && returnTo.startsWith("/")) {
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}customerId=${id}`);
    }
    redirect(`/customers/${id}`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function createAndSubmitQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("quotes.create");
  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "{}"));
    const id = await createQuote(payload);
    if (!id) {
      return { error: "Could not create the quote." };
    }
    await submitQuote(id);
    revalidatePath("/quotes");
    revalidatePath("/home");
    redirect(`/quotes/${id}?notice=submitted`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function submitQuoteAction(quoteId: string) {
  await requirePermission("quotes.submit");
  try {
    await submitQuote(quoteId);
    revalidatePath(`/quotes/${quoteId}`);
    redirect(`/quotes/${quoteId}?notice=submitted`);
  } catch (error) {
    rethrowNavigationError(error);
    redirect(
      `/quotes/${quoteId}?error=${encodeURIComponent(humanizeError(error))}`,
    );
  }
}

export async function sendQuoteAction(quoteId: string) {
  await requirePermission("quotes.send_to_customer");
  try {
    const orderId = await sendQuoteToCustomer(quoteId);
    revalidatePath("/orders");
    redirect(`/orders/${orderId}?notice=sent`);
  } catch (error) {
    rethrowNavigationError(error);
    redirect(
      `/quotes/${quoteId}?error=${encodeURIComponent(humanizeError(error))}`,
    );
  }
}

export async function approveQuoteAction(quoteId: string) {
  await requirePermission("quotes.approve");
  try {
    await approveQuote(quoteId);
    revalidatePath("/approvals");
    redirect(`/approvals/${quoteId}?notice=approved`);
  } catch (error) {
    rethrowNavigationError(error);
    redirect(
      `/approvals/${quoteId}?error=${encodeURIComponent(humanizeError(error))}`,
    );
  }
}

export async function rejectQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("quotes.reject");
  const quoteId = String(formData.get("quote_id"));
  try {
    await rejectQuote({
      quote_id: quoteId,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/approvals");
    redirect(`/approvals/${quoteId}?notice=rejected`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function reviseQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("quotes.revise");
  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "{}"));
    await reviseQuote(payload);
    const quoteId = payload.quote_id as string;
    await submitQuote(quoteId);
    redirect(`/quotes/${quoteId}?notice=revised`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function recordPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.record");
  const orderId = String(formData.get("order_id") ?? "");
  try {
    await recordPayment({
      quote_id: String(formData.get("quote_id")),
      kind: formData.get("kind"),
      amount: Number(formData.get("amount") ?? 0),
      method: formData.get("method") || undefined,
      reference: formData.get("reference") || undefined,
      notes: formData.get("notes") || undefined,
    });
    revalidatePath("/orders");
    revalidatePath("/payments");
    redirect(`/orders/${orderId}?notice=payment`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function verifyPaymentAction(paymentId: string, orderId?: string) {
  await requirePermission("payments.verify");
  try {
    await verifyPayment(paymentId);
    revalidatePath("/payments");
    redirect(
      orderId
        ? `/orders/${orderId}?notice=verified`
        : "/payments?notice=verified",
    );
  } catch (error) {
    rethrowNavigationError(error);
    redirect(`/payments?error=${encodeURIComponent(humanizeError(error))}`);
  }
}

export async function rejectPaymentAction(formData: FormData) {
  await requirePermission("payments.verify");
  const paymentId = String(formData.get("payment_id"));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reject_payment", {
    p_payment_id: paymentId,
    p_notes: String(formData.get("notes") ?? "Rejected"),
  });
  if (error) {
    redirect(`/payments?error=${encodeURIComponent(humanizeError(error))}`);
  }
  redirect("/payments?notice=payment-rejected");
}

export async function sendToVendorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("orders.send_to_vendor");
  const orderId = String(formData.get("order_id"));
  try {
    const items = JSON.parse(String(formData.get("items") ?? "[]"));
    await sendOrderToVendor({
      order_id: orderId,
      vendor_id: String(formData.get("vendor_id")),
      expected_delivery: formData.get("expected_delivery") || undefined,
      items,
    });
    redirect(`/fulfillment/${orderId}?notice=sent-vendor`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function dispatchAction(vendorOrderId: string, orderId: string) {
  await requirePermission("fulfillment.update");
  try {
    await markVendorDispatched(vendorOrderId);
    redirect(`/fulfillment/${orderId}?notice=dispatched`);
  } catch (error) {
    rethrowNavigationError(error);
    redirect(
      `/fulfillment/${orderId}?error=${encodeURIComponent(humanizeError(error))}`,
    );
  }
}

export async function receiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("fulfillment.update");
  const orderId = String(formData.get("order_id"));
  try {
    await recordItemsReceived({
      vendor_order_id: String(formData.get("vendor_order_id")),
      received: JSON.parse(String(formData.get("received") ?? "[]")),
    });
    redirect(`/orders/${orderId}?notice=received`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function createVendorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("orders.send_to_vendor");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Vendor name is required" };
  }
  try {
    const db = await createServerSupabaseClient();
    const { error } = await db.from("vendors").insert({
      name,
      phone: String(formData.get("phone") ?? "") || null,
    });
    if (error) {
      throw error;
    }
    revalidatePath("/vendors");
    redirect("/vendors");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function completeDeliveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("deliveries.complete");
  const orderId = String(formData.get("order_id"));
  try {
    await completeDelivery({
      order_id: orderId,
      notes: formData.get("notes") || undefined,
    });
    redirect(`/orders/${orderId}?notice=delivered`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}
