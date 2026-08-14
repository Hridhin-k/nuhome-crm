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
  sku: string;
  name: string;
  categoryId: string;
  unit: string;
  sellPrice: number;
  cost: number;
}) {
  const db = await getDb();
  const { error } = await db.from("materials").upsert(
    {
      sku: input.sku,
      name: input.name,
      category_id: input.categoryId,
      unit: input.unit,
      default_sell_price: input.sellPrice,
      default_cost: input.cost,
      is_active: true,
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
  const { error } = await db.from("vendors").insert({
    name: input.name,
    phone: input.phone || null,
    email: input.email || null,
    notes: input.notes || null,
  });
  if (error) {
    throw error;
  }
}
