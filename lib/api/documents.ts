import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { isOrderNumber } from "@/lib/orders/ref";
import type { AttachmentKind } from "@/lib/validation/documents";
import type { Database } from "@/types/database";

const SIGNED_URL_TTL = 60 * 60;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export type AttachmentRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  kind: AttachmentKind | Database["public"]["Enums"]["attachment_kind"];
  file_name: string | null;
  mime_type: string | null;
  storage_path: string;
  created_at: string;
  uploaded_by: string | null;
  url: string | null;
};

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
}

export const getCompanySettings = cache(async () => {
  const db = await getDb();
  const { data, error } = await db
    .from("company_settings")
    .select(
      "id, legal_name, gstin, address, phone, email, state_code, default_gst_rate",
    )
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    throw new Error("Failed to load company settings");
  }
  return (
    data ?? {
      id: 1,
      legal_name: "Nuhome",
      gstin: null,
      address: null,
      phone: null,
      email: null,
      state_code: null,
      default_gst_rate: 18,
    }
  );
});

export async function updateCompanySettings(input: {
  legalName: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  stateCode?: string | null;
  defaultGstRate: number;
}) {
  const db = await getDb();
  const { error } = await db
    .from("company_settings")
    .update({
      legal_name: input.legalName,
      gstin: input.gstin || null,
      address: input.address || null,
      phone: input.phone || null,
      email: input.email || null,
      state_code: input.stateCode || null,
      default_gst_rate: input.defaultGstRate,
    })
    .eq("id", 1);
  if (error) throw error;
}

export const listAttachments = cache(async (entityType: string, entityId: string) => {
  const db = await getDb();
  const rows = await throwQuery(
    db
      .from("attachments")
      .select(
        "id, entity_type, entity_id, kind, file_name, mime_type, storage_path, created_at, uploaded_by",
      )
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false }),
    "Failed to load files",
  );

  return Promise.all(
    rows.map(async (row) => {
      const { data } = await db.storage
        .from("attachments")
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL);
      return { ...row, url: data?.signedUrl ?? null } satisfies AttachmentRow;
    }),
  );
});

export async function uploadAttachment(input: {
  entityType: "customer" | "quote" | "order";
  entityId: string;
  kind: AttachmentKind;
  file: File;
  uploadedBy: string;
}) {
  if (input.file.size === 0) {
    throw new Error("Choose a file");
  }
  if (input.file.size > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 10 MB)");
  }
  const mime = input.file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mime)) {
    throw new Error("Use a PDF or image (JPG, PNG, WebP)");
  }

  const db = await getDb();
  const path = `${input.entityType}/${input.entityId}/${crypto.randomUUID()}_${safeFileName(input.file.name)}`;
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const { error: storageError } = await db.storage
    .from("attachments")
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (storageError) {
    throw new Error("Could not upload that file");
  }

  const { error } = await db.from("attachments").insert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    kind: input.kind,
    storage_path: path,
    file_name: input.file.name,
    mime_type: mime,
    uploaded_by: input.uploadedBy,
  });
  if (error) {
    await db.storage.from("attachments").remove([path]);
    throw new Error("Could not save the file");
  }
}

export async function deleteAttachment(id: string, userId: string, isAdmin: boolean) {
  const db = await getDb();
  const { data, error } = await db
    .from("attachments")
    .select("id, storage_path, uploaded_by")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    throw new Error("File not found");
  }
  if (data.uploaded_by !== userId && !isAdmin) {
    throw new Error("You can only remove a file you uploaded");
  }
  const { error: delError } = await db.from("attachments").delete().eq("id", id);
  if (delError) throw new Error("Could not remove the file");
  await db.storage.from("attachments").remove([data.storage_path]);
}

export const getInstallationForOrder = cache(async (orderId: string) => {
  const db = await getDb();
  const { data, error } = await db
    .from("installations")
    .select("id, order_id, scheduled_on, notes, status, completed_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error("Failed to load installation");
  return data;
});

export const listWarrantiesForOrder = cache(async (orderId: string) => {
  const db = await getDb();
  return throwQuery(
    db
      .from("warranties")
      .select("id, order_id, kind, starts_on, ends_on, notes")
      .eq("order_id", orderId)
      .order("kind"),
    "Failed to load warranties",
  );
});

export async function upsertInstallation(input: {
  orderId: string;
  scheduledOn: string;
  notes?: string | null;
  status?: Database["public"]["Enums"]["installation_status"];
  userId: string;
}) {
  const db = await getDb();
  const existing = await getInstallationForOrder(input.orderId);
  const status = input.status ?? existing?.status ?? "scheduled";
  const completedAt =
    status === "done" ? new Date().toISOString() : status === "scheduled" ? null : existing?.completed_at ?? null;

  if (existing) {
    const { error } = await db
      .from("installations")
      .update({
        scheduled_on: input.scheduledOn,
        notes: input.notes || null,
        status,
        completed_at: completedAt,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await db.from("installations").insert({
    order_id: input.orderId,
    scheduled_on: input.scheduledOn,
    notes: input.notes || null,
    status,
    created_by: input.userId,
  });
  if (error) throw error;
}

export async function upsertWarranty(input: {
  orderId: string;
  kind: Database["public"]["Enums"]["coverage_kind"];
  startsOn: string;
  endsOn: string;
  notes?: string | null;
  userId: string;
}) {
  const db = await getDb();
  const { error } = await db.from("warranties").upsert(
    {
      order_id: input.orderId,
      kind: input.kind,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      notes: input.notes || null,
      created_by: input.userId,
    },
    { onConflict: "order_id,kind" },
  );
  if (error) throw error;
}

export const getTaxInvoice = cache(async (orderId: string) => {
  const db = await getDb();
  let resolvedId = orderId;
  if (isOrderNumber(orderId)) {
    const { data: match } = await db
      .from("orders")
      .select("id")
      .ilike("order_number", orderId.trim())
      .maybeSingle();
    if (!match) {
      throw new Error("Order not found");
    }
    resolvedId = match.id;
  }

  const { data: invoiceNumber, error: invoiceError } = await db.rpc(
    "ensure_tax_invoice",
    { p_order_id: resolvedId },
  );
  if (invoiceError || !invoiceNumber) {
    throw new Error("Could not issue a tax invoice for this order");
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id, quote_id, customer_id, status, invoice_number, invoice_issued_at, order_number")
    .eq("id", resolvedId)
    .maybeSingle();
  if (orderError || !order) {
    throw new Error("Order not found");
  }

  const [company, customer, quote] = await Promise.all([
    getCompanySettings(),
    db
      .from("customers")
      .select("id, name, phone, email, gstin, address, billing_address, site_address")
      .eq("id", order.customer_id)
      .maybeSingle(),
    db
      .from("quotes")
      .select(
        "id, quote_number, current_version_id, quote_versions!quotes_current_version_fk(version_number, subtotal, discount, tax, total, notes, created_at)",
      )
      .eq("id", order.quote_id)
      .maybeSingle(),
  ]);

  const versionId = quote.data?.current_version_id;
  const items = versionId
    ? await throwQuery(
        db
          .from("quote_items")
          .select(
            "id, description, quantity, unit_price, discount, tax, line_total, hsn_code, gst_rate",
          )
          .eq("version_id", versionId)
          .order("sort_order"),
        "Failed to load invoice lines",
      )
    : [];

  return {
    invoiceNumber: order.invoice_number ?? invoiceNumber,
    issuedAt: order.invoice_issued_at,
    company,
    customer: customer.data,
    quote: quote.data,
    orderNumber: order.order_number,
    items,
  };
});
