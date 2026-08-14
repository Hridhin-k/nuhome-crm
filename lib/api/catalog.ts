import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";

export type MaterialRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  default_sell_price: number | string;
  default_cost: number | string;
  is_active?: boolean;
  category_id: string | null;
  material_categories?: { id: string; name: string } | null;
};

export type VendorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  is_active: boolean;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  phone: string | null;
  email: string | null;
};

export const listCategories = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db.from("material_categories").select("id, name").order("name"),
    "Failed to load categories",
  );
});

export function listMaterials(options?: { includeInactive?: boolean }) {
  return listMaterialsCached(Boolean(options?.includeInactive));
}

const listMaterialsCached = cache(async (includeInactive: boolean) => {
  const db = await getDb();
  let request = db
    .from("materials")
    .select(
      "id, name, sku, unit, default_sell_price, default_cost, is_active, category_id, material_categories(id, name)",
    )
    .order("name");
  if (!includeInactive) {
    request = request.eq("is_active", true);
  }
  return throwQuery(request, "Failed to load materials") as Promise<MaterialRow[]>;
});

export function listVendors(options?: { includeInactive?: boolean }) {
  return listVendorsCached(Boolean(options?.includeInactive));
}

const listVendorsCached = cache(async (includeInactive: boolean) => {
  const db = await getDb();
  let request = db
    .from("vendors")
    .select("id, name, phone, email, notes, is_active")
    .order("name");
  if (!includeInactive) {
    request = request.eq("is_active", true);
  }
  return throwQuery(request, "Failed to load vendors") as Promise<VendorRow[]>;
});

export const listPendingPayments = cache(async () => {
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
});

export const listProfiles = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db
      .from("profiles")
      .select("id, full_name, role, is_active, phone, email")
      .order("full_name"),
    "Failed to load users",
  ) as Promise<ProfileRow[]>;
});

export const getCatalogSnapshot = cache(async () => {
  const [users, vendors, materials] = await Promise.all([
    listProfiles(),
    listVendors({ includeInactive: true }),
    listMaterials({ includeInactive: true }),
  ]);
  return {
    users: users.length,
    vendors: vendors.length,
    materials: materials.length,
  };
});
