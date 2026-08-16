import { getDb, throwQuery } from "@/lib/api/db";

export async function ensureCategoryId(name: string) {
  const db = await getDb();
  const trimmed = name.trim();
  const existing = await throwQuery(
    db
      .from("material_categories")
      .select("id")
      .ilike("name", trimmed)
      .limit(1),
    "Failed to look up category",
  );
  if (existing[0]) {
    return existing[0].id;
  }

  const { data, error } = await db
    .from("material_categories")
    .insert({ name: trimmed })
    .select("id")
    .single();

  if (error) {
    const retry = await throwQuery(
      db
        .from("material_categories")
        .select("id")
        .ilike("name", trimmed)
        .limit(1),
      "Failed to look up category",
    );
    if (retry[0]) return retry[0].id;
    throw error;
  }
  return data.id;
}

export async function upsertMaterial(input: {
  id?: string;
  sku: string;
  name: string;
  categoryId: string;
  unit: string;
  sellPrice: number;
  cost: number;
  hsnCode?: string | null;
  gstRate?: number;
  warrantyMonths?: number;
  isActive?: boolean;
}) {
  const db = await getDb();
  const gstFields = {
    hsn_code: input.hsnCode || null,
    gst_rate: input.gstRate ?? 18,
    warranty_months: input.warrantyMonths ?? 12,
  };
  if (input.id) {
    const { error } = await db
      .from("materials")
      .update({
        sku: input.sku,
        name: input.name,
        category_id: input.categoryId,
        unit: input.unit,
        default_sell_price: input.sellPrice,
        default_cost: input.cost,
        is_active: input.isActive ?? true,
        ...gstFields,
      })
      .eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("materials").upsert(
    {
      sku: input.sku,
      name: input.name,
      category_id: input.categoryId,
      unit: input.unit,
      default_sell_price: input.sellPrice,
      default_cost: input.cost,
      is_active: true,
      ...gstFields,
    },
    { onConflict: "sku" },
  );
  if (error) {
    throw error;
  }
}

export async function insertVendor(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}) {
  const db = await getDb();
  const { data, error } = await db
    .from("vendors")
    .insert({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id;
}

export async function updateVendor(input: {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive?: boolean;
}) {
  const db = await getDb();
  const { error } = await db
    .from("vendors")
    .update({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      notes: input.notes || null,
      is_active: input.isActive ?? true,
    })
    .eq("id", input.id);
  if (error) throw error;
}

export async function replaceVendorContacts(
  vendorId: string,
  contacts: { name: string; phone?: string | null; email?: string | null; notes?: string | null }[],
) {
  const db = await getDb();
  const { error: delError } = await db
    .from("vendor_contacts")
    .delete()
    .eq("vendor_id", vendorId);
  if (delError) throw delError;
  const rows = contacts
    .map((contact) => ({
      vendor_id: vendorId,
      name: contact.name,
      phone: contact.phone || null,
      email: contact.email || null,
      notes: contact.notes || null,
    }))
    .filter((row) => row.name);
  if (rows.length === 0) return;
  const { error } = await db.from("vendor_contacts").insert(rows);
  if (error) throw error;
}
