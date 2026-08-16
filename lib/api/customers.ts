import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { sanitizeSearch } from "@/lib/search";

export const countCustomers = cache(async () => {
  const db = await getDb();
  const { count, error } = await db
    .from("customers")
    .select("id", { count: "exact", head: true });
  if (error) {
    throw new Error(`Failed to count customers: ${error.message}`);
  }
  return count ?? 0;
});

export const listCustomers = cache(async (query?: string) => {
  const db = await getDb();
  const q = sanitizeSearch(query);

  let request = db
    .from("customers")
    .select("id, name, phone, email, address, gstin, billing_address, site_address, created_at, updated_at, created_by")
    .order("updated_at", { ascending: false });

  if (q) {
    const quoted = await throwQuery(
      db.from("quotes").select("customer_id").ilike("quote_number", `%${q}%`),
      "Failed to search quotes",
    );
    const ordered = await throwQuery(
      db.from("orders").select("customer_id").ilike("order_number", `%${q}%`),
      "Failed to search orders",
    );
    const quoteCustomerIds = [
      ...new Set(
        [...quoted, ...ordered].map((row) => row.customer_id).filter(Boolean),
      ),
    ];
    request = request.or(
      [
        `name.ilike.%${q}%`,
        `phone.ilike.%${q}%`,
        `email.ilike.%${q}%`,
        quoteCustomerIds.length > 0
          ? `id.in.(${quoteCustomerIds.join(",")})`
          : null,
      ]
        .filter(Boolean)
        .join(","),
    );
  }

  return throwQuery(request, "Failed to load customers");
});

export const getCustomer = cache(async (id: string) => {
  const db = await getDb();
  const { data, error } = await db
    .from("customers")
    .select("id, name, phone, email, address, gstin, billing_address, site_address, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load customer");
  }
  return data;
});

export async function createCustomerRow(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  billing_address?: string;
  site_address?: string;
  notes?: string;
  createdBy: string;
}) {
  await assertPhoneAvailable(input.phone);
  const billing = input.billing_address || input.address || null;
  const site = input.site_address || billing;
  const db = await getDb();
  const { data, error } = await db
    .from("customers")
    .insert({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: billing,
      gstin: input.gstin || null,
      billing_address: billing,
      site_address: site,
      notes: input.notes || null,
      kind: "customer",
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw phoneConflictError(error) ?? new Error("Failed to save customer");
  }

  return data.id;
}

export async function updateCustomerRow(input: {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  billing_address?: string;
  site_address?: string;
  notes?: string;
}) {
  await assertPhoneAvailable(input.phone, input.id);
  const billing = input.billing_address || input.address || null;
  const site = input.site_address || billing;
  const db = await getDb();
  const { error } = await db
    .from("customers")
    .update({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: billing,
      gstin: input.gstin || null,
      billing_address: billing,
      site_address: site,
      notes: input.notes || null,
    })
    .eq("id", input.id);

  if (error) {
    throw phoneConflictError(error) ?? new Error("Failed to update customer");
  }
}

async function assertPhoneAvailable(phone?: string, excludeId?: string) {
  if (!phone?.trim()) return;
  const db = await getDb();
  const { data, error } = await db.rpc("find_customer_by_phone", {
    p_phone: phone,
  });
  if (error) {
    throw new Error("Failed to check phone number");
  }
  const match = data?.[0];
  if (match && match.id !== excludeId) {
    throw new Error(
      `A customer named ${match.name} already has this phone number.`,
    );
  }
}

function phoneConflictError(error: { code?: string; message: string } | null) {
  if (!error) return null;
  if (error.code === "23505" || /customers_phone_normalized/i.test(error.message)) {
    return new Error("A customer with this phone number already exists.");
  }
  return null;
}
