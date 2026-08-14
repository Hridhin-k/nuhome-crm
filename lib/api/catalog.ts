import { getDb, throwQuery } from "@/lib/api/db";

export type MaterialRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  default_sell_price: number | string;
  default_cost: number | string;
  category_id: string | null;
  material_categories?: { id: string; name: string } | null;
};

export async function listCategories() {
  const db = await getDb();
  return throwQuery(
    db.from("material_categories").select("id, name").order("name"),
    "Failed to load categories",
  );
}

export async function listMaterials() {
  const db = await getDb();
  return throwQuery(
    db
      .from("materials")
      .select(
        "id, name, sku, unit, default_sell_price, default_cost, is_active, category_id, material_categories(id, name)",
      )
      .eq("is_active", true)
      .order("name"),
    "Failed to load materials",
  ) as Promise<MaterialRow[]>;
}

export async function listVendors() {
  const db = await getDb();
  return throwQuery(
    db
      .from("vendors")
      .select("id, name, phone, email, is_active")
      .eq("is_active", true)
      .order("name"),
    "Failed to load vendors",
  );
}

export async function listPendingPayments() {
  const db = await getDb();
  return throwQuery(
    db
      .from("payments")
      .select(
        "id, amount, kind, status, created_at, quote_id, order_id, recorded_by, quotes(quote_number, customers(name))",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    "Failed to load payments",
  );
}

export async function listProfiles() {
  const db = await getDb();
  return throwQuery(
    db
      .from("profiles")
      .select("id, full_name, role, is_active, phone")
      .order("full_name"),
    "Failed to load users",
  );
}
