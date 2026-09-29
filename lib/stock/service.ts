import { officeBalances, quantityDelta } from "@/lib/stock/balances";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  adjustStockSchema,
  createStockPurchaseSchema,
  handOverOfficeSchema,
  receiveStockSchema,
  voidOfficeHandoverSchema,
} from "@/lib/validation/stock";

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function parseForm<T>(
  result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } },
) {
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Check the form");
  }
  return result.data;
}

export async function createStockPurchase(input: unknown) {
  const parsed = createStockPurchaseSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_stock_purchase", {
    p_vendor_id: parsed.vendor_id,
    p_items: parsed.items,
    p_notes: parsed.notes,
  });
  throwIfError(error);
  return data;
}

export async function sendStockPurchase(purchaseId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("send_stock_purchase", {
    p_purchase_id: purchaseId,
  });
  throwIfError(error);
}

export async function receiveStockPurchase(input: unknown) {
  const parsed = receiveStockSchema.parse(input);
  const lines = parsed.items.filter((item) => item.quantity > 0);
  if (lines.length === 0) {
    throw new Error("Enter a received quantity");
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("receive_stock_purchase", {
    p_purchase_id: parsed.purchase_id,
    p_items: lines,
  });
  throwIfError(error);
}

export async function closeStockPurchase(purchaseId: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("close_stock_purchase", {
    p_purchase_id: purchaseId,
  });
  throwIfError(error);
}

/**
 * Make the quantity left at the office match what Operations saved on the material.
 * Pieces already on a saved quote stay held on top of that number.
 */
export async function setMaterialOfficeOnHand(materialId: string, quantity: number) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("stock_movements")
    .select("material_id, kind, quantity")
    .eq("material_id", materialId);
  throwIfError(error);
  const balance = officeBalances(data ?? []).get(materialId);
  const onHand = balance?.onHand ?? 0;
  const reserved = balance?.reserved ?? 0;
  const delta = quantityDelta(onHand, quantity + reserved);
  if (delta === 0) return;
  const { error: adjustError } = await supabase.rpc("adjust_office_stock", {
    p_material_id: materialId,
    p_delta: delta,
    p_reason: "Quantity set on the material",
  });
  throwIfError(adjustError);
}

export async function adjustOfficeStock(input: unknown) {
  const parsed = adjustStockSchema.parse(input);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("adjust_office_stock", {
    p_material_id: parsed.material_id,
    p_delta: parsed.delta,
    p_reason: parsed.reason,
  });
  throwIfError(error);
}

export async function handOverOfficeLines(input: unknown) {
  const parsed = parseForm(handOverOfficeSchema.safeParse(input));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("hand_over_office_lines", {
    p_quote_id: parsed.quote_id,
    p_amount: parsed.amount,
    p_method: parsed.method,
    p_reference: parsed.reference,
    p_notes: parsed.notes,
  });
  throwIfError(error);
  return data;
}

export async function voidOfficeHandover(input: unknown) {
  const parsed = parseForm(voidOfficeHandoverSchema.safeParse(input));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("void_office_handover", {
    p_quote_id: parsed.quote_id,
    p_reason: parsed.reason,
  });
  throwIfError(error);
}
