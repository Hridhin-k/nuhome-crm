"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureCategoryId,
  getMaterialsBySku,
  insertVendor,
  replaceMaterialVendors,
  replaceVendorContacts,
  updateVendor,
  upsertMaterial,
} from "@/lib/api/catalog-write";
import {
  MATERIAL_CSV_COLUMNS,
  planMaterialCsvRow,
  type MaterialCsvPlan,
} from "@/lib/catalog/material-csv";
import { normalizeMaterialSpecs } from "@/lib/catalog/material-specs";
import { normalizeMaterialVendors } from "@/lib/catalog/material-vendors";
import { listVendors } from "@/lib/api/catalog";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import { revalidateApp } from "@/lib/api/revalidate";
import { parseAppRole, generateTempPassword } from "@/lib/auth/roles";
import { requireAnyPermission, requirePermission } from "@/lib/auth/guards";
import { APP_ROLES, type AppRole } from "@/lib/workflow/types";
import { readCsvTable } from "@/lib/csv";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { setMaterialOfficeOnHand } from "@/lib/stock/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createStaffSchema,
  materialInputSchema,
  updateStaffSchema,
  vendorInputSchema,
  type CreateStaffInput,
  type VendorInput,
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

type RowError = { row: number; message: string };

async function readCsvFile(
  formData: FormData,
  columns: { required: readonly string[]; allowed: readonly string[] },
) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a CSV file");
  }
  if (file.size > 1_000_000) {
    throw new Error("CSV is too large (max 1 MB)");
  }
  const table = readCsvTable(await file.text(), columns);
  if (table.rows.length === 0) {
    throw new Error("The file has column names but no rows under them");
  }
  if (table.rows.length > MAX_CSV_ROWS) {
    throw new Error(`CSV has too many rows (max ${MAX_CSV_ROWS})`);
  }
  return table;
}

/** Every row is checked before anything is saved, so a bad file changes nothing. */
function rejectedImport(rowErrors: RowError[]): AdminActionState {
  return {
    error: `Nothing was imported. Fix ${rowErrors.length === 1 ? "this row" : `these ${rowErrors.length} rows`} and import the file again.`,
    failed: rowErrors.length,
    rowErrors,
  };
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
  await requireAnyPermission("admin.manage", "staff.manage");
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
  const actor = await requireAnyPermission("admin.manage", "staff.manage");
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
  await requireAnyPermission("admin.manage", "staff.manage");
  try {
    const { headers, rows, lines } = await readCsvFile(formData, {
      required: ["email", "role"],
      allowed: ["email", "full_name", "name", "role", "phone", "password"],
    });
    if (!headers.includes("full_name") && !headers.includes("name")) {
      throw new Error("Row 1 must be the column names, and full_name is missing. Start from the sample CSV.");
    }
    const roleList = `${APP_ROLES.slice(0, -1).join(", ")}, or ${APP_ROLES.at(-1)}`;
    const rowErrors: RowError[] = [];
    const firstRowForEmail = new Map<string, number>();
    const planned: {
      line: number;
      generated: boolean;
      data: CreateStaffInput;
    }[] = [];

    for (const [index, row] of rows.entries()) {
      const line = lines[index];
      const email = (row.email ?? "").trim().toLowerCase();
      const fullName = (row.full_name || row.name || "").trim();
      const roleCell = (row.role ?? "").trim();
      const role = parseAppRole(roleCell);
      const phone = (row.phone ?? "").trim();
      const typedPassword = (row.password ?? "").trim();

      if (!role) {
        rowErrors.push({
          row: line,
          message: roleCell
            ? `Role “${roleCell}” is not one of ${roleList}`
            : `Role is required: ${roleList}`,
        });
        continue;
      }
      const parsed = createStaffSchema.safeParse({
        email,
        full_name: fullName,
        role,
        phone: phone || undefined,
        password: typedPassword || generateTempPassword(),
      });
      if (!parsed.success) {
        rowErrors.push({
          row: line,
          message: parsed.error.issues[0]?.message ?? "Check this row",
        });
        continue;
      }
      const earlier = firstRowForEmail.get(email);
      if (earlier) {
        rowErrors.push({ row: line, message: `${email} is already on row ${earlier}` });
        continue;
      }
      firstRowForEmail.set(email, line);
      planned.push({ line, generated: !typedPassword, data: parsed.data });
    }
    if (rowErrors.length > 0) return rejectedImport(rowErrors);

    const admin = createServiceRoleClient();
    const db = await createServerSupabaseClient();
    const credentials: { email: string; password: string }[] = [];
    let created = 0;
    let skipped = 0;

    for (const { line, generated, data: staff } of planned) {
      const { data, error } = await admin.auth.admin.createUser({
        email: staff.email,
        password: staff.password,
        email_confirm: true,
        user_metadata: {
          full_name: staff.full_name,
          role: staff.role,
          phone: staff.phone ?? "",
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
        p_full_name: staff.full_name,
        p_phone: staff.phone ?? null,
        p_role: staff.role,
        p_is_active: true,
      });
      if (updateError) {
        rowErrors.push({ row: line, message: updateError.message });
        continue;
      }

      created += 1;
      if (generated) {
        credentials.push({ email: staff.email, password: staff.password });
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
  await requireAnyPermission("admin.manage", "catalog.manage");
  let vendorRows: unknown = [];
  try {
    const raw = formString(formData, "vendors");
    vendorRows = raw ? JSON.parse(raw) : [];
  } catch {
    return { error: "Vendors could not be read" };
  }
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
    // Always persist (empty clears). Do not coerce "" → undefined or upsert skips the column.
    description: formString(formData, "description"),
    is_active: formString(formData, "is_active") !== "false",
    office_quantity: parseMoney(formString(formData, "office_quantity")),
    vendors: vendorRows,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  let vendorLinks;
  let specs;
  try {
    vendorLinks = normalizeMaterialVendors(parsed.data.vendors ?? []);
    const rawSpecs = formString(formData, "specs");
    specs = normalizeMaterialSpecs(rawSpecs ? JSON.parse(rawSpecs) : []);
  } catch (error) {
    return {
      error: error instanceof SyntaxError ? "Specs could not be read" : humanizeError(error),
    };
  }
  try {
    const categoryId = await ensureCategoryId(parsed.data.category);
    const materialId = await upsertMaterial({
      sku: parsed.data.sku,
      name: parsed.data.name,
      categoryId,
      unit: parsed.data.unit,
      sellPrice: parsed.data.sell_price,
      cost: parsed.data.cost,
      hsnCode: parsed.data.hsn_code ?? null,
      gstRate: parsed.data.gst_rate,
      warrantyMonths: parsed.data.warranty_months,
      description: parsed.data.description ?? "",
      specs,
      id: parsed.data.id,
      isActive: parsed.data.is_active,
    });
    if (parsed.data.office_quantity !== undefined) {
      await setMaterialOfficeOnHand(materialId, parsed.data.office_quantity);
    }
    if (vendorLinks.length > 0) {
      await replaceMaterialVendors(materialId, vendorLinks);
    }
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
  await requireAnyPermission("admin.manage", "catalog.manage");
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
  await requireAnyPermission("admin.manage", "catalog.manage");
  try {
    const { rows, lines } = await readCsvFile(formData, {
      required: ["sku"],
      allowed: MATERIAL_CSV_COLUMNS,
    });
    const saved = await getMaterialsBySku([
      ...new Set(rows.map((row) => (row.sku ?? "").trim()).filter(Boolean)),
    ]);
    const rowErrors: RowError[] = [];
    const firstRowForSku = new Map<string, number>();
    const plans: { line: number; plan: MaterialCsvPlan }[] = [];

    for (const [index, row] of rows.entries()) {
      const line = lines[index];
      const sku = (row.sku ?? "").trim();
      const earlier = firstRowForSku.get(sku);
      if (sku && earlier) {
        rowErrors.push({ row: line, message: `SKU ${sku} is already on row ${earlier}` });
        continue;
      }
      if (sku) firstRowForSku.set(sku, line);
      try {
        plans.push({ line, plan: planMaterialCsvRow(row, saved.get(sku)) });
      } catch (error) {
        rowErrors.push({ row: line, message: humanizeError(error) });
      }
    }
    if (rowErrors.length > 0) return rejectedImport(rowErrors);

    let added = 0;
    let updated = 0;
    for (const { line, plan } of plans) {
      try {
        const categoryId =
          "id" in plan.category
            ? plan.category.id
            : await ensureCategoryId(plan.category.name);
        const materialId = await upsertMaterial({
          id: plan.id,
          sku: plan.sku,
          name: plan.name,
          categoryId,
          unit: plan.unit,
          sellPrice: plan.sellPrice,
          cost: plan.cost,
          hsnCode: plan.hsnCode,
          gstRate: plan.gstRate,
          warrantyMonths: plan.warrantyMonths,
          description: plan.description,
          specs: plan.specs,
        });
        if (plan.officeQuantity !== undefined) {
          await setMaterialOfficeOnHand(materialId, plan.officeQuantity);
        }
        if (plan.vendors) {
          await replaceMaterialVendors(materialId, plan.vendors);
        }
        if (plan.id) updated += 1;
        else added += 1;
      } catch (error) {
        rowErrors.push({ row: line, message: humanizeError(error) });
      }
    }

    refreshCatalog();
    const parts = [
      added ? `${added} added` : "",
      updated ? `${updated} updated` : "",
    ].filter(Boolean);
    return {
      created: added + updated,
      failed: rowErrors.length,
      rowErrors,
      notice: parts.length ? `Materials ${parts.join(", ")}.` : "No materials were saved.",
    };
  } catch (error) {
    return { error: humanizeError(error) };
  }
}

export async function createVendorAdminAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAnyPermission("admin.manage", "catalog.manage", "orders.send_to_vendor");
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
  await requireAnyPermission("admin.manage", "catalog.manage");
  try {
    const { rows, lines } = await readCsvFile(formData, {
      required: ["name"],
      allowed: ["name", "phone", "email", "notes"],
    });
    const rowErrors: RowError[] = [];
    const planned: { line: number; vendor: VendorInput }[] = [];
    for (const [index, row] of rows.entries()) {
      const parsed = vendorInputSchema.safeParse({
        name: (row.name ?? "").trim(),
        phone: (row.phone ?? "").trim() || undefined,
        email: (row.email ?? "").trim() || undefined,
        notes: (row.notes ?? "").trim() || undefined,
      });
      if (!parsed.success) {
        rowErrors.push({
          row: lines[index],
          message: parsed.error.issues[0]?.message ?? "Check this row",
        });
        continue;
      }
      planned.push({ line: lines[index], vendor: parsed.data });
    }
    if (rowErrors.length > 0) return rejectedImport(rowErrors);

    const existing = await listVendors({ includeInactive: true });
    const seen = new Set(
      existing.map((vendor) => `${vendor.name.toLowerCase()}|${vendor.phone ?? ""}`),
    );
    let created = 0;
    let skipped = 0;
    for (const { line, vendor } of planned) {
      const key = `${vendor.name.toLowerCase()}|${vendor.phone ?? ""}`;
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      try {
        await insertVendor({
          name: vendor.name,
          phone: vendor.phone,
          email: vendor.email,
          notes: vendor.notes,
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
  await requireAnyPermission("admin.manage", "staff.manage");
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
  await requireAnyPermission("admin.manage", "staff.manage");
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
  await requireAnyPermission("admin.manage", "staff.manage");
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
