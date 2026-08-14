import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";

export const listCustomers = cache(async (query?: string) => {
  const db = await getDb();
  let request = db
    .from("customers")
    .select("id, name, phone, email, address, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (query?.trim()) {
    const q = query.trim().replace(/[%_,()]/g, "").replace(/,/g, " ").trim();
    if (q) {
      request = request.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    }
  }

  return throwQuery(request, "Failed to load customers");
});

export const getCustomer = cache(async (id: string) => {
  const db = await getDb();
  const { data, error } = await db
    .from("customers")
    .select("id, name, phone, email, address, notes, created_at")
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
  notes?: string;
  createdBy: string;
}) {
  await assertPhoneAvailable(input.phone);
  const db = await getDb();
  const { data, error } = await db
    .from("customers")
    .insert({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
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
  notes?: string;
}) {
  await assertPhoneAvailable(input.phone, input.id);
  const db = await getDb();
  const { error } = await db
    .from("customers")
    .update({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
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
