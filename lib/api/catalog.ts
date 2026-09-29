import { cache } from "react";
import { getDb, throwQuery } from "@/lib/api/db";
import { getFloorCounts } from "@/lib/api/floor-counts";
import { relList } from "@/lib/api/rel";
import { parseAppRole } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/workflow/types";

export type MaterialRow = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  default_sell_price: number | string;
  default_cost: number | string;
  hsn_code?: string | null;
  gst_rate?: number | string | null;
  warranty_months?: number | null;
  description?: string | null;
  is_active?: boolean;
  category_id: string | null;
  material_categories?: { id: string; name: string } | null;
};

export type VendorRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
  is_active: boolean;
  vendor_contacts?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
  }[];
};

export type ProfileRow = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
  phone: string | null;
  email: string | null;
  profile_roles?: { role: string }[];
};

export const listCategories = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db.from("material_categories").select("id, name").order("name"),
    "Failed to load categories",
  );
});

export function listMaterials(options?: { includeInactive?: boolean }) {
  return listMaterialsCached(Boolean(options?.includeInactive));
}

const listMaterialsCached = cache(async (includeInactive: boolean) => {
  const db = await getDb();
  let request = db
    .from("materials")
    .select(
      "id, name, sku, unit, default_sell_price, default_cost, hsn_code, gst_rate, warranty_months, description, is_active, category_id, material_categories(id, name)",
    )
    .order("name");
  if (!includeInactive) {
    request = request.eq("is_active", true);
  }
  return throwQuery(request, "Failed to load materials") as Promise<MaterialRow[]>;
});

export type MaterialVendorOffer = {
  material_id: string;
  vendor_id: string;
  unit_cost: number | string;
  is_preferred: boolean;
  vendors?: { name: string; is_active: boolean } | { name: string; is_active: boolean }[] | null;
};

export const listMaterialVendorOffers = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db
      .from("material_vendors")
      .select("material_id, vendor_id, unit_cost, is_preferred, vendors(name, is_active)"),
    "Failed to load material vendors",
  ) as Promise<MaterialVendorOffer[]>;
});

export async function assertCatalogueVendors(
  orderId: string,
  items: { order_item_id: string; vendor_id: string }[],
) {
  const db = await getDb();
  const orderItems = await throwQuery(
    db
      .from("order_items")
      .select("id, material_id, description")
      .eq("order_id", orderId),
    "Failed to load order lines",
  );
  const materialIds = [
    ...new Set(
      orderItems
        .map((item) => item.material_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (materialIds.length === 0) return;

  const links = await throwQuery(
    db
      .from("material_vendors")
      .select("material_id, vendor_id")
      .in("material_id", materialIds),
    "Failed to load material vendors",
  );
  const allowed = new Map<string, Set<string>>();
  for (const link of links) {
    const set = allowed.get(link.material_id) ?? new Set<string>();
    set.add(link.vendor_id);
    allowed.set(link.material_id, set);
  }

  for (const line of items) {
    const item = orderItems.find((row) => row.id === line.order_item_id);
    if (!item?.material_id) continue;
    const vendors = allowed.get(item.material_id);
    if (!vendors || vendors.size === 0) continue;
    if (!vendors.has(line.vendor_id)) {
      throw new Error(
        `${item.description} can only be ordered from a vendor saved on that material`,
      );
    }
  }
}

export function listVendors(options?: { includeInactive?: boolean }) {
  return listVendorsCached(Boolean(options?.includeInactive));
}

const listVendorsCached = cache(async (includeInactive: boolean) => {
  const db = await getDb();
  let request = db
    .from("vendors")
    .select("id, name, phone, email, notes, is_active, vendor_contacts(id, name, phone, email, notes)")
    .order("name");
  if (!includeInactive) {
    request = request.eq("is_active", true);
  }
  return throwQuery(request, "Failed to load vendors") as Promise<VendorRow[]>;
});

export const listPendingPayments = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db
      .from("payments")
      .select(
        "id, amount, kind, method, reference_number, status, created_at, quote_id, order_id, recorded_by, quotes(quote_number, customers(name)), orders(order_number, assigned_sales_id, assigned_sales:profiles!orders_assigned_sales_id_fkey(full_name))",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    "Failed to load payments",
  );
});

export const listProfiles = cache(async () => {
  const db = await getDb();
  return throwQuery(
    db
      .from("profiles")
      .select("id, full_name, role, is_active, phone, email, profile_roles(role)")
      .order("full_name"),
    "Failed to load users",
  ) as Promise<ProfileRow[]>;
});

export function profileRoles(profile: ProfileRow): AppRole[] {
  const extra = relList(profile.profile_roles)
    .map((row) => parseAppRole(row.role))
    .filter((role): role is AppRole => Boolean(role));
  const primary = parseAppRole(profile.role) ?? "sales";
  return extra.includes(primary) ? extra : [primary, ...extra];
}

export function listCoverSales(profiles: ProfileRow[]) {
  return profiles.filter(
    (profile) =>
      profile.is_active &&
      profileRoles(profile).some((role) => role === "sales" || role === "admin"),
  );
}

export const getCatalogSnapshot = cache(async () => {
  const counts = await getFloorCounts();
  return {
    users: counts.catalog_users,
    vendors: counts.catalog_vendors,
    materials: counts.catalog_materials,
  };
});
