import { PrintQuoteButton } from "@/components/quotes/print-quote-button";
import type { PublicQuote } from "@/lib/api/public-quote";
import { formatInrExact } from "@/lib/format/money";

export function CustomerQuoteDocument({ quote }: { quote: PublicQuote }) {
  const { customer, version, items } = quote;
  const issued = new Date(version.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <article className="customer-quote mx-auto max-w-2xl rounded-xl border border-surface-variant bg-white p-6 shadow-card print:border-0 print:shadow-none md:p-10">
      <header className="border-b border-surface-variant pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold text-primary">Nuhome</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Premium home solutions
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-on-surface">{quote.quote_number}</p>
            <p className="text-on-surface-variant">
              Version {version.version_number}
            </p>
            <p className="text-on-surface-variant">{issued}</p>
          </div>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
          Prepared for
        </p>
        <p className="mt-1 text-lg font-semibold">{customer?.name ?? "Customer"}</p>
        {customer?.phone ? (
          <p className="text-sm text-on-surface-variant">{customer.phone}</p>
        ) : null}
        {customer?.address ? (
          <p className="mt-1 text-sm text-on-surface-variant">{customer.address}</p>
        ) : null}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
          Quotation
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-surface-variant text-left text-on-surface-variant">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant">
            {items.map((item, index) => (
              <tr key={`${item.description}-${index}`}>
                <td className="py-2.5 pr-3">{item.description}</td>
                <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatInrExact(Number(item.line_total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-6 border-t border-surface-variant pt-4">
        <dl className="ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Subtotal</dt>
            <dd>{formatInrExact(Number(version.subtotal))}</dd>
          </div>
          {Number(version.discount) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Discount</dt>
              <dd>{formatInrExact(Number(version.discount))}</dd>
            </div>
          ) : null}
          {Number(version.tax) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Tax</dt>
              <dd>{formatInrExact(Number(version.tax))}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-surface-variant pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatInrExact(Number(version.total))}</dd>
          </div>
        </dl>
      </section>

      {version.notes ? (
        <section className="mt-6 rounded-lg bg-surface-container-low p-4 text-sm">
          <p className="font-medium">Notes</p>
          <p className="mt-1 text-on-surface-variant">{version.notes}</p>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-surface-variant pt-4 text-sm text-on-surface-variant">
        <p>Valid subject to stock availability and site conditions.</p>
        <p className="mt-2">Questions? Contact your Nuhome sales representative.</p>
      </footer>

      <PrintQuoteButton />
    </article>
  );
}
