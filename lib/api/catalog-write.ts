import { getDb, throwQuery } from "@/lib/api/db";
import type { MaterialVendorInput } from "@/lib/catalog/material-vendors";

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
  /** Omit to leave existing description unchanged (e.g. CSV without that column). */
  description?: string | null;
  isActive?: boolean;
}) {
  const db = await getDb();
  const descriptionFields =
    input.description === undefined
      ? {}
      : {
          description: input.description?.trim()
            ? input.description.trim()
            : null,
        };
  const gstFields = {
    hsn_code: input.hsnCode || null,
    gst_rate: input.gstRate ?? 18,
    warranty_months: input.warrantyMonths ?? 12,
    ...descriptionFields,
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
    return input.id;
  }
  const { data, error } = await db.from("materials").upsert(
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
  )
    .select("id")
    .single();
  if (error) {
    throw error;
  }
  return data.id;
}

async function resolveVendorId(row: MaterialVendorInput) {
  if (row.vendor_id) return row.vendor_id;
  const name = row.vendor_name?.trim() ?? "";
  const db = await getDb();
  const existing = await throwQuery(
    db.from("vendors").select("id").ilike("name", name).limit(1),
    "Failed to look up vendor",
  );
  if (existing[0]) return existing[0].id;
  return insertVendor({ name });
}

/** Replace who supplies this material. Names that already exist are reused. */
export async function replaceMaterialVendors(
  materialId: string,
  rows: MaterialVendorInput[],
) {
  const db = await getDb();
  const seen = new Set<string>();
  const resolved: {
    material_id: string;
    vendor_id: string;
    unit_cost: number;
    is_preferred: boolean;
  }[] = [];
  for (const row of rows) {
    const vendorId = await resolveVendorId(row);
    if (seen.has(vendorId)) {
      throw new Error("Each vendor can only be added once");
    }
    seen.add(vendorId);
    resolved.push({
      material_id: materialId,
      vendor_id: vendorId,
      unit_cost: row.unit_cost,
      is_preferred: Boolean(row.is_preferred),
    });
  }

  const { error: deleteError } = await db
    .from("material_vendors")
    .delete()
    .eq("material_id", materialId);
  if (deleteError) throw deleteError;
  if (resolved.length === 0) return;
  const { error } = await db.from("material_vendors").insert(resolved);
  if (error) throw error;
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
