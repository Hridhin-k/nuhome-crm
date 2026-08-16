"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureCategoryId,
  insertVendor,
  replaceVendorContacts,
  updateVendor,
  upsertMaterial,
} from "@/lib/api/catalog-write";
import { listVendors } from "@/lib/api/catalog";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import { revalidateApp } from "@/lib/api/revalidate";
import { parseAppRole, generateTempPassword } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/guards";
import type { AppRole } from "@/lib/workflow/types";
import { parseCsv } from "@/lib/csv";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createStaffSchema,
  materialInputSchema,
  updateStaffSchema,
  vendorInputSchema,
} from "@/lib/validation/admin";

export type AdminActionState = {
  error?: string;
  notice?: string;
  created?: number;
  skipped?: number;
  failed?: number;
  credentials?: { email: string; password: string }[];
  rowErrors?: { row: number; message: string }[];
};

const MAX_CSV_ROWS = 200;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parseMoney(value: string) {
  if (!value) return 0;
  const n = Number(value.replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function readCsvFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a CSV file");
  }
  if (file.size > 1_000_000) {
    throw new Error("CSV is too large (max 1 MB)");
  }
  const { rows } = parseCsv(await file.text());
  if (rows.length === 0) {
    throw new Error("CSV has no data rows");
  }
  if (rows.length > MAX_CSV_ROWS) {
    throw new Error(`CSV has too many rows (max ${MAX_CSV_ROWS})`);
  }
  return rows;
}

function refreshCatalog() {
  revalidateApp();
  revalidatePath("/users");
  revalidatePath("/vendors");
  revalidatePath("/materials");
  revalidatePath("/home");
}

function extraRolesFromForm(formData: FormData, primary: AppRole): AppRole[] {
  return formData
    .getAll("extra_roles")
    .map((value) => (typeof value === "string" ? parseAppRole(value) : null))
    .filter((role): role is AppRole => Boolean(role) && role !== primary);
}

async function applyProfileRoles(
  db: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
  primary: AppRole,
  extras: AppRole[],
) {
  const { error } = await db.rpc("admin_set_profile_roles", {
    p_user_id: userId,
    p_roles: [primary, ...extras],
  });
  if (error) throw error;
}

export async function createStaffAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  const parsed = createStaffSchema.safeParse({
    email: formString(formData, "email"),
    full_name: formString(formData, "full_name"),
    role: formString(formData, "role"),
    phone: formString(formData, "phone") || undefined,
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  try {
    const admin = createServiceRoleClient();
    const db = await createServerSupabaseClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: {
        full_name: parsed.data.full_name,
        role: parsed.data.role,
        phone: parsed.data.phone ?? "",
      },
    });
    if (error || !data.user) {
      throw error ?? new Error("Could not create the login");
    }

    const { error: updateError } = await db.rpc("admin_update_user", {
      p_user_id: data.user.id,
      p_full_name: parsed.data.full_name,
      p_phone: parsed.data.phone ?? null,
      p_role: parsed.data.role,
      p_is_active: true,
    });
    if (updateError) {
      throw updateError;
    }
    await applyProfileRoles(
      db,
      data.user.id,
      parsed.data.role,
      extraRolesFromForm(formData, parsed.data.role),
    );

    refreshCatalog();
    redirect("/users?notice=user-created");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function updateStaffAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requirePermission("admin.manage");
  const parsed = updateStaffSchema.safeParse({
    user_id: formString(formData, "user_id"),
    full_name: formString(formData, "full_name"),
    role: formString(formData, "role"),
    extra_roles: extraRolesFromForm(formData, parseAppRole(formString(formData, "role")) ?? "sales"),
    phone: formString(formData, "phone") || undefined,
    is_active: formData.get("is_active") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  if (parsed.data.user_id === actor.id && !parsed.data.is_active) {
    return { error: "You cannot deactivate your own account" };
  }

  try {
    const db = await createServerSupabaseClient();
    const { error } = await db.rpc("admin_update_user", {
      p_user_id: parsed.data.user_id,
      p_full_name: parsed.data.full_name,
      p_phone: parsed.data.phone ?? null,
      p_role: parsed.data.role,
      p_is_active: parsed.data.is_active,
    });
    if (error) {
      throw error;
    }
    await applyProfileRoles(
      db,
      parsed.data.user_id,
      parsed.data.role,
      parsed.data.extra_roles ?? [],
    );
    refreshCatalog();
    redirect("/users?notice=user-updated");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function importStaffCsvAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  try {
    const rows = await readCsvFile(formData);
    const admin = createServiceRoleClient();
    const db = await createServerSupabaseClient();
    const credentials: { email: string; password: string }[] = [];
    const rowErrors: { row: number; message: string }[] = [];
    let created = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const email = (row.email ?? "").trim().toLowerCase();
      const fullName = (row.full_name || row.name || "").trim();
      const role = parseAppRole(row.role);
      const phone = (row.phone ?? "").trim();
      let password = (row.password ?? "").trim();
      const generated = !password;
      if (!password) {
        password = generateTempPassword();
      }

      const parsed = createStaffSchema.safeParse({
        email,
        full_name: fullName,
        role: role ?? "sales",
        phone: phone || undefined,
        password,
      });
      if (!email || !fullName || !role || !parsed.success) {
        rowErrors.push({
          row: line,
          message: !role
            ? "Role must be sales, accounts, procurement, store, or admin"
            : (parsed.error?.issues[0]?.message ?? "Invalid row"),
        });
        continue;
      }

      const { data, error } = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: {
          full_name: parsed.data.full_name,
          role: parsed.data.role,
          phone: parsed.data.phone ?? "",
        },
      });
      if (error || !data.user) {
        if (error && /already registered|already been registered|exists/i.test(error.message)) {
          skipped += 1;
          continue;
        }
        rowErrors.push({
          row: line,
          message: error?.message ?? "Could not create login",
        });
        continue;
      }

      const { error: updateError } = await db.rpc("admin_update_user", {
        p_user_id: data.user.id,
        p_full_name: parsed.data.full_name,
        p_phone: parsed.data.phone ?? null,
        p_role: parsed.data.role,
        p_is_active: true,
      });
      if (updateError) {
        rowErrors.push({ row: line, message: updateError.message });
        continue;
      }

      created += 1;
      if (generated) {
        credentials.push({ email: parsed.data.email, password: parsed.data.password });
      }
    }

    refreshCatalog();
    return {
      created,
      skipped,
      failed: rowErrors.length,
      credentials,
      rowErrors,
      notice:
        created > 0
          ? `Imported ${created} user${created === 1 ? "" : "s"}.`
          : "No new users were created.",
    };
  } catch (error) {
    return { error: humanizeError(error) };
  }
}

export async function createMaterialAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  const parsed = materialInputSchema.safeParse({
    id: formString(formData, "id") || undefined,
    name: formString(formData, "name"),
    sku: formString(formData, "sku"),
    category: formString(formData, "category"),
    unit: formString(formData, "unit") || "pcs",
    sell_price: parseMoney(formString(formData, "sell_price")),
    cost: parseMoney(formString(formData, "cost")),
    hsn_code: formString(formData, "hsn_code") || undefined,
    gst_rate: parseMoney(formString(formData, "gst_rate") || "18") ?? 18,
    warranty_months: Number(formString(formData, "warranty_months") || "12") || 12,
    is_active: formString(formData, "is_active") !== "false",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  try {
    const categoryId = await ensureCategoryId(parsed.data.category);
    await upsertMaterial({
      sku: parsed.data.sku,
      name: parsed.data.name,
      categoryId,
      unit: parsed.data.unit,
      sellPrice: parsed.data.sell_price,
      cost: parsed.data.cost,
      hsnCode: parsed.data.hsn_code,
      gstRate: parsed.data.gst_rate,
      warrantyMonths: parsed.data.warranty_months,
      id: parsed.data.id,
      isActive: parsed.data.is_active,
    });
    refreshCatalog();
    redirect(
      parsed.data.id
        ? "/materials?notice=material-updated"
        : "/materials?notice=material-saved",
    );
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function toggleMaterialAction(formData: FormData) {
  await requirePermission("admin.manage");
  const id = formString(formData, "id");
  const next = formString(formData, "is_active") === "true";
  const db = await createServerSupabaseClient();
  const { error } = await db.from("materials").update({ is_active: next }).eq("id", id);
  if (error) {
    redirect(`/materials?error=${encodeURIComponent(humanizeError(error))}`);
  }
  refreshCatalog();
  redirect("/materials?notice=material-updated");
}

export async function importMaterialsCsvAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  try {
    const rows = await readCsvFile(formData);
    const rowErrors: { row: number; message: string }[] = [];
    let created = 0;

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const parsed = materialInputSchema.safeParse({
        name: (row.name ?? "").trim(),
        sku: (row.sku ?? "").trim(),
        category: (row.category ?? "").trim(),
        unit: (row.unit ?? "").trim() || "pcs",
        sell_price: parseMoney(row.sell_price ?? ""),
        cost: parseMoney(row.cost ?? ""),
        hsn_code: (row.hsn_code ?? "").trim() || undefined,
        gst_rate: row.gst_rate ? parseMoney(row.gst_rate) : 18,
        warranty_months: row.warranty_months
          ? Number(row.warranty_months)
          : 12,
      });
      if (!parsed.success) {
        rowErrors.push({
          row: line,
          message: parsed.error.issues[0]?.message ?? "Invalid row",
        });
        continue;
      }
      try {
        const categoryId = await ensureCategoryId(parsed.data.category);
        await upsertMaterial({
          sku: parsed.data.sku,
          name: parsed.data.name,
          categoryId,
          unit: parsed.data.unit,
          sellPrice: parsed.data.sell_price,
          cost: parsed.data.cost,
          hsnCode: parsed.data.hsn_code,
          gstRate: parsed.data.gst_rate,
          warrantyMonths: parsed.data.warranty_months,
        });
        created += 1;
      } catch (error) {
        rowErrors.push({ row: line, message: humanizeError(error) });
      }
    }

    refreshCatalog();
    return {
      created,
      failed: rowErrors.length,
      rowErrors,
      notice:
        created > 0
          ? `Imported ${created} material${created === 1 ? "" : "s"}.`
          : "No materials were imported.",
    };
  } catch (error) {
    return { error: humanizeError(error) };
  }
}

export async function createVendorAdminAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("orders.send_to_vendor");
  let contacts: { name: string; phone?: string; email?: string; notes?: string }[] =
    [];
  try {
    const raw = formString(formData, "contacts");
    if (raw) {
      contacts = JSON.parse(raw) as typeof contacts;
    }
  } catch {
    return { error: "Contacts could not be read" };
  }
  const parsed = vendorInputSchema.safeParse({
    name: formString(formData, "name"),
    phone: formString(formData, "phone") || undefined,
    email: formString(formData, "email") || undefined,
    notes: formString(formData, "notes") || undefined,
    is_active: formString(formData, "is_active") !== "false",
    contacts: contacts.filter((contact) => contact.name?.trim()),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  try {
    const id = formString(formData, "id");
    let vendorId = id;
    if (id) {
      await updateVendor({
        id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        notes: parsed.data.notes,
        isActive: parsed.data.is_active,
      });
    } else {
      vendorId = await insertVendor({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        notes: parsed.data.notes,
      });
    }
    await replaceVendorContacts(vendorId, parsed.data.contacts ?? []);
    refreshCatalog();
    redirect("/vendors?notice=vendor-saved");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function importVendorsCsvAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  try {
    const rows = await readCsvFile(formData);
    const existing = await listVendors({ includeInactive: true });
    const seen = new Set(
      existing.map((vendor) => `${vendor.name.toLowerCase()}|${vendor.phone ?? ""}`),
    );
    const rowErrors: { row: number; message: string }[] = [];
    let created = 0;
    let skipped = 0;

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const parsed = vendorInputSchema.safeParse({
        name: (row.name ?? "").trim(),
        phone: (row.phone ?? "").trim() || undefined,
        email: (row.email ?? "").trim() || undefined,
        notes: (row.notes ?? "").trim() || undefined,
      });
      if (!parsed.success) {
        rowErrors.push({
          row: line,
          message: parsed.error.issues[0]?.message ?? "Invalid row",
        });
        continue;
      }
      const key = `${parsed.data.name.toLowerCase()}|${parsed.data.phone ?? ""}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      try {
        await insertVendor({
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          notes: parsed.data.notes,
        });
        seen.add(key);
        created += 1;
      } catch (error) {
        rowErrors.push({ row: line, message: humanizeError(error) });
      }
    }

    refreshCatalog();
    return {
      created,
      skipped,
      failed: rowErrors.length,
      rowErrors,
      notice:
        created > 0
          ? `Imported ${created} vendor${created === 1 ? "" : "s"}.`
          : "No new vendors were created.",
    };
  } catch (error) {
    return { error: humanizeError(error) };
  }
}

export async function resetStaffPasswordAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  const userId = formString(formData, "user_id");
  const email = formString(formData, "email");
  if (!userId) {
    return { error: "User is required" };
  }
  try {
    const password = generateTempPassword();
    const admin = createServiceRoleClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) throw error;
    return {
      notice: "New password generated. Copy it now — it is not shown again.",
      credentials: [{ email: email || "staff", password }],
    };
  } catch (error) {
    return { error: humanizeError(error) };
  }
}

export async function reassignSalesCoverAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  const fromId = formString(formData, "from_user_id");
  const toId = formString(formData, "to_user_id");
  try {
    const db = await createServerSupabaseClient();
    const { data, error } = await db.rpc("reassign_sales_cover", {
      p_from_user_id: fromId,
      p_to_user_id: toId,
    });
    if (error) throw error;
    const moved = data as { customers?: number; quotes?: number; orders?: number } | null;
    refreshCatalog();
    revalidatePath("/orders");
    revalidatePath("/quotes");
    revalidatePath("/customers");
    return {
      notice: `Moved ${moved?.customers ?? 0} customers, ${moved?.quotes ?? 0} open quotes, ${moved?.orders ?? 0} open orders.`,
    };
  } catch (error) {
    return { error: humanizeError(error) };
  }
}

export async function reassignOrderSalesAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePermission("admin.manage");
  const orderId = formString(formData, "order_id");
  try {
    const db = await createServerSupabaseClient();
    const { error } = await db.rpc("reassign_order_sales", {
      p_order_id: orderId,
      p_to_user_id: formString(formData, "to_user_id"),
    });
    if (error) throw error;
    refreshCatalog();
    revalidatePath(`/orders/${orderId}`);
    redirect(`/orders/${orderId}?notice=reassigned`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}
