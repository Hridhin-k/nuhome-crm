import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { officeBalances } from "@/lib/stock/balances";

export const listOfficeStock = cache(async (quoteId?: string) => {
  const db = await getDb();
  return throwQuery(
    db.rpc("list_office_stock", quoteId ? { p_quote_id: quoteId } : {}),
    "Failed to load office stock",
  );
});

export const listMaterialOfficeBalances = cache(async () => {
  const db = await getDb();
  const rows = await throwQuery(
    db.from("stock_movements").select("material_id, kind, quantity"),
    "Failed to load office quantities",
  );
  return officeBalances(rows);
});

export const listStockPurchases = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db
      .from("stock_purchases")
      .select(
        "id, purchase_number, status, notes, created_at, vendor_id, vendors(name), stock_purchase_items(id, material_id, description, quantity, quantity_received, unit_cost)",
      )
      .order("created_at", { ascending: false }),
    "Failed to load stock purchases",
  );
});

export const getStockPurchase = cache(async (id: string) => {
  const db = await getDb();
  const { data, error } = await db
    .from("stock_purchases")
    .select(
      "id, purchase_number, status, notes, created_at, vendor_id, vendors(name), stock_purchase_items(id, material_id, description, quantity, quantity_received, unit_cost)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load stock purchase: ${error.message}`);
  return data;
});
