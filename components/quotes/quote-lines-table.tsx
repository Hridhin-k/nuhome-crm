import { formatInrExact } from "@/lib/format/money";
import { displaySpecification } from "@/lib/quotes/spec";
import { cn } from "@/lib/utils";

export type QuoteLineDisplay = {
  description: string;
  item_code?: string | null;
  specification?: string | null;
  hsn_code?: string | null;
  quantity: number | string;
  line_total?: number | string | null;
};

export function QuoteLinesTable({
  items,
  showAmount = true,
  className,
}: {
  items: QuoteLineDisplay[];
  showAmount?: boolean;
  className?: string;
}) {
  return (
    <table className={cn("w-full text-sm", className)}>
      <thead>
        <tr className="border-b border-outline-variant text-left text-on-surface-variant">
          <th className="pb-2 font-medium">Item</th>
          <th className="pb-2 font-medium">Item code</th>
          <th className="hidden pb-2 font-medium sm:table-cell">Specification</th>
          <th className="pb-2 text-right font-medium">Qty</th>
          {showAmount ? (
            <th className="pb-2 text-right font-medium">Amount</th>
          ) : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-outline-variant">
        {items.map((item, index) => {
          const spec = displaySpecification(item.specification, item.description);
          return (
            <tr key={`${item.description}-${index}`}>
              <td className="py-3 pr-3">
                <p>{item.description}</p>
                {spec ? (
                  <p className="mt-1 text-xs text-on-surface-variant sm:hidden">
                    {spec}
                  </p>
                ) : null}
              </td>
              <td className="py-3 pr-3 font-mono text-xs text-on-surface-variant">
                {item.item_code?.trim() || "—"}
              </td>
              <td className="hidden py-3 pr-3 text-on-surface-variant sm:table-cell">
                {spec || "—"}
              </td>
              <td className="py-3 text-right tabular-nums">{item.quantity}</td>
              {showAmount ? (
                <td className="py-3 text-right tabular-nums">
                  {formatInrExact(Number(item.line_total ?? 0))}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
