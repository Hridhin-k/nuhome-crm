import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requirePermission("quotes.create");
  const { customerId } = await searchParams;
  redirect(
    customerId ? `/walk-in?customerId=${customerId}&step=2` : "/walk-in",
  );
}
