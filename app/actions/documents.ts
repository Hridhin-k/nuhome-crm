"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import {
  deleteAttachment,
  updateCompanySettings,
  uploadAttachment,
  upsertInstallation,
  upsertWarranty,
} from "@/lib/api/documents";
import { requirePermission, requireUser } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import {
  companySettingsSchema,
  installationSchema,
  uploadAttachmentSchema,
  warrantySchema,
} from "@/lib/validation/documents";

export type DocumentActionState = { error?: string };

function safeReturnTo(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.startsWith("/") ? value : null;
}

export async function saveCompanySettingsAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  await requirePermission("admin.manage");
  const parsed = companySettingsSchema.safeParse({
    legal_name: formData.get("legal_name"),
    gstin: formData.get("gstin") || undefined,
    address: formData.get("address") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    state_code: formData.get("state_code") || undefined,
    default_gst_rate: Number(formData.get("default_gst_rate") ?? 18),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  try {
    await updateCompanySettings({
      legalName: parsed.data.legal_name,
      gstin: parsed.data.gstin,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      stateCode: parsed.data.state_code,
      defaultGstRate: parsed.data.default_gst_rate,
    });
    revalidatePath("/company");
    revalidatePath("/", "layout");
    redirect("/company?notice=saved");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function uploadAttachmentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const user = await requireUser();
  const parsed = uploadAttachmentSchema.safeParse({
    entity_type: formData.get("entity_type"),
    entity_id: formData.get("entity_id"),
    kind: formData.get("kind"),
    return_to: formData.get("return_to") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the file" };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file" };
  }
  try {
    await uploadAttachment({
      entityType: parsed.data.entity_type,
      entityId: parsed.data.entity_id,
      kind: parsed.data.kind,
      file,
      uploadedBy: user.id,
    });
    const dest = parsed.data.return_to ?? `/${parsed.data.entity_type}s/${parsed.data.entity_id}`;
    revalidatePath(dest.split("?")[0]);
    redirect(`${dest}${dest.includes("?") ? "&" : "?"}notice=uploaded`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function deleteAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const returnTo = safeReturnTo(formData.get("return_to")) ?? "/home";
  try {
    await deleteAttachment(
      id,
      user.id,
      rolesHavePermission(user.roles, "admin.manage"),
    );
  } catch (error) {
    redirect(
      `${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(humanizeError(error))}`,
    );
  }
  revalidatePath(returnTo.split("?")[0]);
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}notice=file-removed`);
}

export async function saveInstallationAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const user = await requireUser();
  const parsed = installationSchema.safeParse({
    order_id: formData.get("order_id"),
    scheduled_on: formData.get("scheduled_on"),
    notes: formData.get("notes") || undefined,
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the dates" };
  }
  try {
    await upsertInstallation({
      orderId: parsed.data.order_id,
      scheduledOn: parsed.data.scheduled_on,
      notes: parsed.data.notes,
      status: parsed.data.status,
      userId: user.id,
    });
    revalidatePath(`/orders/${parsed.data.order_id}`);
    redirect(`/orders/${parsed.data.order_id}?notice=install`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function saveWarrantyAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const user = await requireUser();
  const parsed = warrantySchema.safeParse({
    order_id: formData.get("order_id"),
    kind: formData.get("kind"),
    starts_on: formData.get("starts_on"),
    ends_on: formData.get("ends_on"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the dates" };
  }
  if (parsed.data.ends_on < parsed.data.starts_on) {
    return { error: "End date must be after the start date" };
  }
  try {
    await upsertWarranty({
      orderId: parsed.data.order_id,
      kind: parsed.data.kind,
      startsOn: parsed.data.starts_on,
      endsOn: parsed.data.ends_on,
      notes: parsed.data.notes,
      userId: user.id,
    });
    revalidatePath(`/orders/${parsed.data.order_id}`);
    redirect(`/orders/${parsed.data.order_id}?notice=warranty`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}
