import { getDb } from "@/lib/api/db";
import type { AuditEvent } from "@/lib/workflow/audit-labels";

type RpcClient = {
  rpc(
    fn: string,
    args: Record<string, string>,
  ): Promise<{ data: AuditEvent[] | null; error: { message: string } | null }>;
};

async function callAuditRpc(fn: string, args: Record<string, string>) {
  const db = (await getDb()) as unknown as RpcClient;
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    throw new Error("Failed to load activity");
  }
  return data ?? [];
}

export async function listQuoteActivity(quoteId: string) {
  return callAuditRpc("list_quote_activity", { p_quote_id: quoteId });
}

export async function listOrderActivity(orderId: string) {
  return callAuditRpc("list_order_activity", { p_order_id: orderId });
}
