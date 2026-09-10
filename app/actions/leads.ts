"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { convertLead, upsertLead } from "@/lib/api/leads";
import { humanizeError, rethrowNavigationError } from "@/lib/api/errors";
import { requirePermission } from "@/lib/auth/guards";

export type ActionState = { error?: string };

export async function saveLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("leads.manage");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };
  try {
    await upsertLead({
      id: String(formData.get("id") ?? "") || undefined,
      name,
      phone: String(formData.get("phone") ?? "") || undefined,
      firm: String(formData.get("firm") ?? "") || undefined,
      place: String(formData.get("place") ?? "") || undefined,
      remarks: String(formData.get("remarks") ?? "") || undefined,
      follow_up_on: String(formData.get("follow_up_on") ?? "") || undefined,
    });
    revalidatePath("/leads");
    redirect("/leads?notice=saved");
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}

export async function convertLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission("leads.manage");
  try {
    const customerId = await convertLead(String(formData.get("id")), user.id);
    revalidatePath("/leads");
    revalidatePath("/customers");
    redirect(`/customers/${customerId}`);
  } catch (error) {
    rethrowNavigationError(error);
    return { error: humanizeError(error) };
  }
}
