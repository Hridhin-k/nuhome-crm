import { redirect } from "next/navigation";

export default async function ApprovalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const sp = new URLSearchParams();
  if (query.notice) sp.set("notice", query.notice);
  if (query.error) sp.set("error", query.error);
  const suffix = sp.toString();
  redirect(`/quotes/${id}${suffix ? `?${suffix}` : ""}`);
}
