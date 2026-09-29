"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import { requirePermission } from "@/lib/auth/guards";
import {
  adjustOfficeStock,
  closeStockPurchase,
  createStockPurchase,
  handOverOfficeLines,
  receiveStockPurchase,
  sendStockPurchase,
  voidOfficeHandover,
} from "@/lib/stock/service";

export type StockActionState = { error?: string };

export async function createStockPurchaseAction(
  _prev: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  await requirePermission("stock.purchase");
  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "{}"));
    const id = await createStockPurchase(payload);
    if (!id) return { error: "Could not create the purchase." };
    await sendStockPurchase(id);
    revalidatePath("/stock");
    redirect(`/stock/${id}?notice=sent`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function receiveStockAction(
  _prev: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  await requirePermission("stock.receive");
  try {
    const payload = JSON.parse(String(formData.get("payload") ?? "{}"));
    await receiveStockPurchase(payload);
    revalidatePath("/stock");
    revalidatePath(`/stock/${payload.purchase_id}`);
    redirect(`/stock/${payload.purchase_id}?notice=received`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function closeStockPurchaseAction(purchaseId: string) {
  await requirePermission("stock.purchase");
  try {
    await closeStockPurchase(purchaseId);
  } catch (error) {
    rethrowNavigationError(error);
    const message = humanizeError(error);
    redirect(`/stock/${purchaseId}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/stock");
  redirect(`/stock/${purchaseId}?notice=closed`);
}

export async function adjustStockAction(
  _prev: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  await requirePermission("stock.adjust");
  try {
    await adjustOfficeStock({
      material_id: formData.get("material_id"),
      delta: Number(formData.get("delta")),
      reason: formData.get("reason"),
    });
    revalidatePath("/stock");
    redirect("/stock?notice=adjusted");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function handOverOfficeAction(
  _prev: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  await requirePermission("stock.sell");
  const quoteId = String(formData.get("quote_id") ?? "");
  try {
    const orderId = await handOverOfficeLines({
      quote_id: quoteId,
      amount: Number(formData.get("amount")),
      method: formData.get("method"),
      reference: String(formData.get("reference") ?? "") || undefined,
      notes: String(formData.get("notes") ?? "") || undefined,
    });
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/stock");
    if (orderId) revalidatePath(`/orders/${orderId}`);
    redirect(`/quotes/${quoteId}?notice=handed-over`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function voidOfficeHandoverAction(
  _prev: StockActionState,
  formData: FormData,
): Promise<StockActionState> {
  await requirePermission("stock.sell");
  const quoteId = String(formData.get("quote_id") ?? "");
  try {
    await voidOfficeHandover({
      quote_id: quoteId,
      reason: formData.get("reason"),
    });
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/stock");
    redirect(`/quotes/${quoteId}?notice=handover-voided`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}
