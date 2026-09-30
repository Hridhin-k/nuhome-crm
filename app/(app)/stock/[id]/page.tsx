import { notFound } from "next/navigation";
import { closeStockPurchaseAction } from "@/app/actions/stock";
import { Notice } from "@/components/app/notice";
import { PageFrame } from "@/components/app/page-frame";
import { PageHeader } from "@/components/app/page-header";
import { ReceiveForm } from "@/components/stock/receive-form";
import { getStockPurchase } from "@/lib/api/stock";
import { rel, relList } from "@/lib/api/rel";
import { requirePermission } from "@/lib/auth/guards";
import { rolesHavePermission } from "@/lib/auth/permissions";
import { formatInrExact } from "@/lib/format/money";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/app/form-error";

export default async function StockPurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const user = await requirePermission("stock.read");
  const { id } = await params;
  const { notice, error } = await searchParams;
  const purchase = await getStockPurchase(id);
  if (!purchase) notFound();

  const vendor = rel(purchase.vendors);
  const lines = relList(purchase.stock_purchase_items);
  const canReceive = rolesHavePermission(user.roles, "stock.receive");
  const canClose = rolesHavePermission(user.roles, "stock.purchase");
  const open = purchase.status === "sent" || purchase.status === "partial";

  return (
    <PageFrame width="detail" className="flex flex-col gap-4">
      <PageHeader
        title={purchase.purchase_number}
        description={[vendor?.name, purchase.status].filter(Boolean).join(" · ")}
      />
      {notice === "sent" ? <Notice>Sent to the vendor. Receive it when it arrives.</Notice> : null}
      {notice === "received" ? <Notice>Quantity added to office stock.</Notice> : null}
      {notice === "closed" ? <Notice>Short receipt closed. Nothing further will be received.</Notice> : null}
      {error ? <FormError>{error}</FormError> : null}

      <ul className="divide-y divide-surface-variant rounded-2xl border border-outline-variant bg-card px-4 shadow-card">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <span>
              <span className="block font-medium">{line.description}</span>
              <span className="text-on-surface-variant">
                Cost {formatInrExact(Number(line.unit_cost))}
              </span>
            </span>
            <span className="text-on-surface-variant">
              {Number(line.quantity_received)}/{Number(line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      {open && canReceive ? (
        <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
          <h2 className="mb-3 text-subheading">Receive</h2>
          <ReceiveForm
            purchaseId={purchase.id}
            lines={lines.map((line) => ({
              id: line.id,
              description: line.description,
              quantity: Number(line.quantity),
              quantity_received: Number(line.quantity_received),
            }))}
          />
        </section>
      ) : null}

      {open && canClose ? (
        <form action={closeStockPurchaseAction.bind(null, purchase.id)}>
          <Button type="submit" variant="bordered">
            Close short receipt
          </Button>
        </form>
      ) : null}
    </PageFrame>
  );
}
