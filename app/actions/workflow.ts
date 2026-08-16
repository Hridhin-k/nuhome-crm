"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import {
  approveQuote,
  cancelJob,
  completeDelivery,
  createQuote,
  markVendorDispatched,
  recordItemsReceived,
  recordPayment,
  rejectPayment,
  rejectQuote,
  reviseQuote,
  sendOrderToVendor,
  sendQuoteToCustomer,
  submitQuote,
  verifyPayment,
  writeOffItems,
} from "@/lib/workflow/service";
import { createCustomerRow, updateCustomerRow } from "@/lib/api/customers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { customerSchema, rejectPaymentSchema } from "@/lib/validation/workflow";

export type ActionState = { error?: string; notice?: string };

type RpcClient = {
  rpc(
    fn: string,
    args: Record<string, string>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function createCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("customers.write");
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("billing_address") || formData.get("address") || undefined,
    gstin: formData.get("gstin") || undefined,
    billing_address: formData.get("billing_address") || undefined,
    site_address: formData.get("site_address") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  const customerId = String(formData.get("customer_id") ?? "").trim();
  try {
    if (customerId) {
      await updateCustomerRow({ id: customerId, ...parsed.data });
      revalidatePath("/customers");
      revalidatePath(`/customers/${customerId}`);
      redirect(`/customers/${customerId}?notice=updated`);
    }
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

export async function saveQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const intent = String(formData.get("intent") ?? "submit");
  await requirePermission(intent === "submit" ? "quotes.submit" : "quotes.create");
  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "{}"));
    const existingId =
      typeof payload.quote_id === "string" ? payload.quote_id : "";
    if (existingId) {
      await requirePermission("quotes.revise");
      await reviseQuote(payload);
    }
    const quoteId = existingId || (await createQuote(payload));
    if (!quoteId) {
      return { error: "Could not save the quote." };
    }
    if (intent === "submit") {
      await requirePermission("quotes.submit");
      await submitQuote(quoteId);
      revalidatePath("/quotes");
      revalidatePath("/home");
      redirect(
        `/quotes/${quoteId}?notice=${existingId ? "revised" : "submitted"}`,
      );
    }
    revalidatePath("/quotes");
    revalidatePath("/home");
    redirect(`/quotes/${quoteId}?notice=draft`);
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
  return saveQuoteAction(_prev, formData);
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

export async function rejectPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.verify");
  const orderId = String(formData.get("order_id") ?? "").trim();
  const parsed = rejectPaymentSchema.safeParse({
    payment_id: formData.get("payment_id"),
    notes: String(formData.get("reason") ?? formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  try {
    await rejectPayment(parsed.data);
    revalidatePath("/payments");
    revalidatePath("/home");
    revalidatePath("/orders");
    if (orderId) {
      revalidatePath(`/orders/${orderId}`);
      redirect(`/orders/${orderId}?notice=payment-rejected`);
    }
    redirect("/payments?notice=payment-rejected");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function sendToVendorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("orders.send_to_vendor");
  const orderId = String(formData.get("order_id"));
  try {
    const items = JSON.parse(String(formData.get("items") ?? "[]")).filter(
      (row: { quantity?: number }) => Number(row.quantity) > 0,
    );
    await sendOrderToVendor({
      order_id: orderId,
      vendor_id: String(formData.get("vendor_id")),
      expected_delivery: formData.get("expected_delivery") || undefined,
      items,
    });
    revalidatePath("/fulfillment");
    revalidatePath("/orders");
    revalidatePath("/home");
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
    revalidatePath("/fulfillment");
    revalidatePath("/orders");
    revalidatePath("/home");
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
    revalidatePath("/fulfillment");
    revalidatePath("/orders");
    revalidatePath("/home");
    redirect(`/fulfillment/${orderId}?notice=received`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function writeOffItemsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("fulfillment.update");
  const orderId = String(formData.get("order_id"));
  try {
    await writeOffItems({
      order_id: orderId,
      notes: String(formData.get("notes") ?? "") || undefined,
      items: JSON.parse(String(formData.get("items") ?? "[]")),
    });
    revalidatePath("/fulfillment");
    revalidatePath("/orders");
    revalidatePath("/home");
    redirect(`/fulfillment/${orderId}?notice=written-off`);
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

export async function cancelJobAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const canCancel =
    rolesHavePermission(user.roles, "quotes.create") ||
    rolesHavePermission(user.roles, "quotes.approve") ||
    rolesHavePermission(user.roles, "orders.send_to_vendor");
  if (!canCancel) {
    return { error: "You don’t have permission to do that." };
  }
  const quoteId = String(formData.get("quote_id"));
  const returnTo = String(formData.get("return_to") ?? "").trim();
  try {
    await cancelJob({
      quote_id: quoteId,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/quotes");
    revalidatePath("/orders");
    revalidatePath("/home");
    revalidatePath("/fulfillment");
    const dest =
      returnTo.startsWith("/quotes/") || returnTo.startsWith("/orders/")
        ? returnTo
        : `/quotes/${quoteId}`;
    redirect(`${dest}${dest.includes("?") ? "&" : "?"}notice=cancelled`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function logWhatsAppShareAction(
  quoteId: string,
): Promise<ActionState> {
  await requirePermission("quotes.send_to_customer");
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await (supabase as unknown as RpcClient).rpc(
      "log_quote_whatsapp_share",
      { p_quote_id: quoteId },
    );
    if (error) {
      throw error;
    }
    revalidatePath(`/quotes/${quoteId}`);
    return {};
  } catch (error) {
    return { error: humanizeError(error) };
  }
}
