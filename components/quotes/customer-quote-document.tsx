import { PrintQuoteButton } from "@/components/quotes/print-quote-button";
import type { PublicQuote } from "@/lib/api/public-quote";
import { formatInrExact } from "@/lib/format/money";

export function CustomerQuoteDocument({ quote }: { quote: PublicQuote }) {
  const { customer, version, items, company } = quote;
  const issued = new Date(version.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const billing = customer?.billing_address || customer?.address;
  const site = customer?.site_address;

  return (
    <article className="customer-quote mx-auto max-w-2xl overflow-hidden rounded-lg border border-outline-variant bg-white px-6 py-8 shadow-card print:border-0 print:shadow-none md:px-12 md:py-12">
      <header className="border-b border-outline-variant pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-headline-lg tracking-tight text-primary">
              {company?.legal_name ?? "Nuhome"}
            </p>
            <p className="mt-1 text-headline-md text-secondary">Quotation</p>
            {company?.gstin ? (
              <p className="mt-2 text-body-sm text-on-surface-variant">
                GSTIN {company.gstin}
              </p>
            ) : null}
          </div>
          <div className="space-y-1 text-right text-data-tabular text-on-surface-variant">
            <p>
              <span className="text-secondary">Ref: </span>
              <span className="font-semibold text-on-surface">
                {quote.quote_number}
              </span>
            </p>
            <p>
              <span className="text-secondary">Version: </span>
              <span className="font-semibold text-on-surface">
                {version.version_number}
              </span>
            </p>
            <p>
              <span className="text-secondary">Date: </span>
              <span className="font-semibold text-on-surface">{issued}</span>
            </p>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <p className="text-label-caps text-secondary">Prepared for</p>
        <div className="mt-2 inline-block min-w-[240px] rounded border border-outline-variant bg-surface-bright p-3">
          <p className="text-subheading">{customer?.name ?? "Customer"}</p>
          {customer?.phone ? (
            <p className="text-body-sm text-on-surface-variant">
              {customer.phone}
            </p>
          ) : null}
          {customer?.gstin ? (
            <p className="text-body-sm text-on-surface-variant">
              GSTIN {customer.gstin}
            </p>
          ) : null}
          {billing ? (
            <p className="mt-1 whitespace-pre-wrap text-body-sm text-on-surface-variant">
              {billing}
            </p>
          ) : null}
          {site && site !== billing ? (
            <p className="mt-1 whitespace-pre-wrap text-body-sm text-on-surface-variant">
              Site: {site}
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant text-left text-on-surface-variant">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 font-medium">HSN</th>
              <th className="pb-2 text-right font-medium">Qty</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {items.map((item, index) => (
              <tr key={`${item.description}-${index}`}>
                <td className="py-3 pr-3">{item.description}</td>
                <td className="py-3 pr-3 text-on-surface-variant">
                  {item.hsn_code ?? "—"}
                </td>
                <td className="py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 text-right tabular-nums">
                  {formatInrExact(Number(item.line_total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 border-t border-outline-variant pt-5">
        <dl className="ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Subtotal</dt>
            <dd className="tabular-nums">
              {formatInrExact(Number(version.subtotal))}
            </dd>
          </div>
          {Number(version.discount) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Discount</dt>
              <dd className="tabular-nums">
                {formatInrExact(Number(version.discount))}
              </dd>
            </div>
          ) : null}
          {Number(version.tax) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">GST</dt>
              <dd className="tabular-nums">
                {formatInrExact(Number(version.tax))}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-outline-variant pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">
              {formatInrExact(Number(version.total))}
            </dd>
          </div>
        </dl>
      </section>

      {version.notes ? (
        <section className="mt-8 bg-muted p-4 text-sm">
          <p className="font-medium">Notes</p>
          <p className="mt-1 text-on-surface-variant">{version.notes}</p>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-outline-variant pt-5 text-sm text-on-surface-variant">
        <p>This quotation is for review. Contact the showroom to confirm.</p>
        <p className="mt-2">Valid subject to stock availability and site conditions.</p>
      </footer>

      <PrintQuoteButton />
    </article>
  );
}
