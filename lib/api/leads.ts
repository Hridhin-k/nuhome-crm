import { getDb, throwQuery } from "@/lib/api/db";
import { cache } from "react";

export const listLeads = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db
      .from("leads")
      .select(
        "id, name, phone, firm, place, remarks, source, follow_up_on, assigned_to, customer_id, created_at, profiles:assigned_to(full_name)",
      )
      .order("updated_at", { ascending: false }),
    "Failed to load leads",
  );
});

export async function upsertLead(input: {
  id?: string;
  name: string;
  phone?: string;
  firm?: string;
  place?: string;
  remarks?: string;
  source?: string;
  follow_up_on?: string;
  assigned_to?: string;
}) {
  const db = await getDb();
  const row = {
    name: input.name,
    phone: input.phone || null,
    firm: input.firm || null,
    place: input.place || null,
    remarks: input.remarks || null,
    source: input.source || null,
    follow_up_on: input.follow_up_on || null,
    assigned_to: input.assigned_to || null,
  };
  if (input.id) {
    const { error } = await db.from("leads").update(row).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await db.from("leads").insert(row).select("id").single();
  if (error || !data) throw error ?? new Error("Failed to save lead");
  return data.id;
}

export async function convertLead(id: string, createdBy: string) {
  const db = await getDb();
  const { data: lead, error } = await db
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !lead) throw error ?? new Error("Lead not found");
  if (lead.customer_id) return lead.customer_id;
  const { data: customer, error: customerError } = await db
    .from("customers")
    .insert({
      name: lead.name ?? "Lead",
      phone: lead.phone,
      firm: lead.firm,
      notes: lead.remarks,
      source: lead.source,
      follow_up_on: lead.follow_up_on,
      kind: "customer",
      created_by: createdBy,
    })
    .select("id")
    .single();
  if (customerError || !customer) {
    throw customerError ?? new Error("Could not convert lead");
  }
  await db
    .from("leads")
    .update({ customer_id: customer.id, converted_at: new Date().toISOString() })
    .eq("id", id);
  return customer.id;
}
