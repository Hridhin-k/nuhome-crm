import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const tables =
  "attachments audit_logs company_settings customers deliveries delivery_items installations leads material_categories material_vendors materials notifications order_items order_status_transitions orders payment_verifications payments permissions profile_roles profiles quote_approvals quote_items quote_status_transitions quote_versions quotes role_permissions roles stock_movements stock_purchase_items stock_purchases vendor_contacts vendor_order_items vendor_orders vendor_payments vendors warranties workflow_transitions".split(
    " ",
  );
for (const t of tables) {
  const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
  console.log(t.padEnd(26), error ? "ERR " + error.message : count);
}
const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 });
console.log("auth users:", users?.users?.length, users?.users?.map((u) => u.email).join(", "));
const { data: buckets } = await sb.storage.listBuckets();
for (const b of buckets ?? []) {
  const { data } = await sb.storage.from(b.id).list("", { limit: 1000 });
  console.log("bucket", b.id, "top-level entries:", data?.length);
}
