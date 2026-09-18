"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendResendEmail } from "@/lib/email/resend";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import {
  allocateVendors,
  approveQuote,
  cancelJob,
  completeDelivery,
  confirmVendorSend,
  createQuote,
  decideCreditDelivery,
  decideVendorQuote,
  markVendorDispatched,
  recordItemsReceived,
  recordPayment,
  recordVendorPayment,
  rejectPayment,
  rejectQuote,
  requestCreditDelivery,
  reviseQuote,
  saveVendorCommercial,
  saveVendorQuote,
  sendQuoteToCustomer,
  submitQuote,
  verifyPayment,
  writeOffItems,
} from "@/lib/workflow/service";
import { createCustomerRow, updateCustomerRow } from "@/lib/api/customers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listFromForm, withOtherValue } from "@/lib/customers/walk-in";
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
  const interests = withOtherValue(
    listFromForm(formData.getAll("interests")),
    "Others",
    String(formData.get("interest_other") ?? ""),
  );
  const parsed = customerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("billing_address") || formData.get("address") || undefined,
    gstin: formData.get("gstin") || undefined,
    billing_address: formData.get("billing_address") || undefined,
    site_address: formData.get("site_address") || undefined,
    notes: formData.get("notes") || undefined,
    firm: formData.get("firm") || undefined,
    whatsapp: formData.get("whatsapp") || undefined,
    profession: listFromForm(formData.getAll("profession")),
    profession_other: formData.get("profession_other") || undefined,
    property_type: formData.get("property_type") || undefined,
    property_other: formData.get("property_other") || undefined,
    project_status: formData.get("project_status") || undefined,
    interests,
    source: formData.get("source") || undefined,
    source_other: formData.get("source_other") || undefined,
    follow_up_on: formData.get("follow_up_on") || undefined,
    follow_up_action: formData.get("follow_up_action") || undefined,
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
      revalidatePath(`/quotes/${quoteId}`);
      revalidatePath("/quotes");
      redirect(
        `/quotes/${quoteId}?notice=${existingId ? "revised" : "submitted"}`,
      );
    }
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/quotes");
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
    if (orderId) revalidatePath(`/orders/${orderId}`);
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
    await allocateVendors({
      order_id: orderId,
      order_number: String(formData.get("order_number") ?? "ORD"),
      expected_delivery: formData.get("expected_delivery") || undefined,
      items,
    });
    revalidatePath(`/fulfillment/${orderId}`);
    revalidatePath("/fulfillment");
    redirect(`/fulfillment/${orderId}?notice=allocated`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function dispatchAction(vendorOrderId: string, orderId: string) {
  await requirePermission("fulfillment.update");
  try {
    await markVendorDispatched(vendorOrderId);
    revalidatePath(`/fulfillment/${orderId}`);
    revalidatePath("/fulfillment");
    redirect(fulfillmentHref(orderId, "dispatched", vendorOrderId));
  } catch (error) {
    rethrowNavigationError(error);
    redirect(
      `/fulfillment/${orderId}?error=${encodeURIComponent(humanizeError(error))}&focus=${vendorOrderId}`,
    );
  }
}

export async function receiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("fulfillment.update");
  const orderId = String(formData.get("order_id"));
  const vendorOrderId = String(formData.get("vendor_order_id"));
  try {
    await recordItemsReceived({
      vendor_order_id: vendorOrderId,
      received: JSON.parse(String(formData.get("received") ?? "[]")),
    });
    revalidatePath(`/fulfillment/${orderId}`);
    revalidatePath("/fulfillment");
    redirect(fulfillmentHref(orderId, "received", vendorOrderId));
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
    revalidatePath(`/fulfillment/${orderId}`);
    revalidatePath("/fulfillment");
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
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/quotes");
    if (returnTo.startsWith("/orders/")) {
      revalidatePath(returnTo.split("?")[0]!);
      revalidatePath("/orders");
    }
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

export async function sendQuoteEmailAction(formData: FormData): Promise<ActionState> {
  await requirePermission("quotes.send_to_customer");
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!email) return { error: "Customer email is required" };
  try {
    await sendResendEmail({
      to: email,
      subject: "Your Nuhome quotation",
      text: message,
      html: `<p>${message.replace(/\n/g, "<br/>")}</p>`,
    });
    return {};
  } catch (error) {
    return { error: humanizeError(error) };
  }
}

export async function requestCreditDeliveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.record");
  try {
    const orderId = String(formData.get("order_id"));
    await requestCreditDelivery(
      orderId,
      String(formData.get("notes") ?? "") || undefined,
    );
    revalidatePath(`/orders/${orderId}`);
    redirect(`/orders/${orderId}?notice=credit-requested`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function decideCreditDeliveryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("deliveries.credit_approve");
  try {
    const orderId = String(formData.get("order_id"));
    await decideCreditDelivery(
      orderId,
      String(formData.get("decision")) === "approve",
    );
    revalidatePath(`/orders/${orderId}`);
    redirect(`/orders/${orderId}?notice=credit-decided`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

function fulfillmentHref(
  orderId: string,
  notice: string,
  vendorOrderId?: string,
) {
  const focus = vendorOrderId ? `&focus=${vendorOrderId}` : "";
  return `/fulfillment/${orderId}?notice=${notice}${focus}`;
}

export async function saveVendorQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("orders.send_to_vendor");
  const orderId = String(formData.get("order_id"));
  const vendorOrderId = String(formData.get("vendor_order_id"));
  try {
    await saveVendorQuote({
      vendor_order_id: vendorOrderId,
      quote_ref: String(formData.get("quote_ref") ?? ""),
      quote_amount: Number(formData.get("quote_amount")),
    });
    revalidatePath(`/fulfillment/${orderId}`);
    redirect(fulfillmentHref(orderId, "quoted", vendorOrderId));
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function decideVendorQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("vendors.quote_approve");
  const orderId = String(formData.get("order_id"));
  const vendorOrderId = String(formData.get("vendor_order_id"));
  try {
    await decideVendorQuote({
      vendor_order_id: vendorOrderId,
      approve: String(formData.get("decision")) === "approve",
      reason: String(formData.get("reason") ?? "") || undefined,
    });
    revalidatePath(`/fulfillment/${orderId}`);
    redirect(fulfillmentHref(orderId, "quote-decided", vendorOrderId));
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function confirmVendorSendAction(
  vendorOrderId: string,
  orderId: string,
) {
  await requirePermission("orders.send_to_vendor");
  try {
    await confirmVendorSend(vendorOrderId);
    revalidatePath(`/fulfillment/${orderId}`);
    revalidatePath("/fulfillment");
    redirect(fulfillmentHref(orderId, "sent-vendor", vendorOrderId));
  } catch (error) {
    rethrowNavigationError(error);
    redirect(
      `/fulfillment/${orderId}?error=${encodeURIComponent(humanizeError(error))}&focus=${vendorOrderId}`,
    );
  }
}

export async function saveVendorCommercialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("fulfillment.update");
  const orderId = String(formData.get("order_id") ?? "");
  const vendorOrderId = String(formData.get("vendor_order_id"));
  try {
    const amount = Number(formData.get("quote_amount") || "");
    await saveVendorCommercial({
      vendor_order_id: vendorOrderId,
      quote_ref: String(formData.get("quote_ref") ?? "") || undefined,
      quote_amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
    });
    revalidatePath("/fulfillment");
    if (orderId) revalidatePath(`/fulfillment/${orderId}`);
    redirect(fulfillmentHref(orderId, "vendor-quoted", vendorOrderId));
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function recordVendorPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("payments.verify");
  const orderId = String(formData.get("order_id") ?? "");
  const vendorOrderId = String(formData.get("vendor_order_id"));
  try {
    await recordVendorPayment({
      vendor_order_id: vendorOrderId,
      amount: Number(formData.get("amount")),
      method: String(formData.get("method") || "") || undefined,
      reference: String(formData.get("reference") ?? "") || undefined,
      bill_ref: String(formData.get("bill_ref") ?? "") || undefined,
    });
    revalidatePath("/fulfillment");
    if (orderId) revalidatePath(`/fulfillment/${orderId}`);
    redirect(fulfillmentHref(orderId, "vendor-paid", vendorOrderId));
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}
