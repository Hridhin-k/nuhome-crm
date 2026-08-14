import { getDb, throwQuery } from "@/lib/api/db";

export async function listCustomers(query?: string) {
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
}

export async function getCustomer(id: string) {
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
}

export async function createCustomerRow(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdBy: string;
}) {
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
    throw new Error("Failed to save customer");
  }

  return data.id;
}
