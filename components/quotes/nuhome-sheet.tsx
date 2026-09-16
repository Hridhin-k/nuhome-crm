import { PrintQuoteButton } from "@/components/quotes/print-quote-button";
import { formatInrExact } from "@/lib/format/money";
import { displaySpecification } from "@/lib/quotes/spec";

export type NuhomeSheetLine = {
  description: string;
  item_code?: string | null;
  specification?: string | null;
  quantity: number | string;
  unit_price?: number | string | null;
  discount?: number | string | null;
  line_total?: number | string | null;
};

export type NuhomeSheetCompany = {
  legal_name: string;
  gstin?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  upi_id?: string | null;
};

function sheetDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function dealerRate(line: NuhomeSheetLine) {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.unit_price) || 0;
  const discount = Number(line.discount) || 0;
  if (qty <= 0) return rate;
  if (discount <= 0) return rate;
  return Math.max(0, (qty * rate - discount) / qty);
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex gap-3 text-[12px] leading-6">
      <span className="w-28 shrink-0 font-semibold uppercase tracking-wide text-neutral-800">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-neutral-800">{value || " "}</span>
    </div>
  );
}

function NuhomeMark() {
  return (
    <div className="flex size-[118px] shrink-0 flex-col items-center justify-center bg-[#154734] text-center text-[#d4af37]">
      <span className="text-[42px] font-semibold leading-none tracking-tight">N</span>
      <span className="mt-1 text-[11px] font-bold tracking-[0.28em] text-white">
        NUHOME
      </span>
      <span className="mt-0.5 px-2 text-[7px] uppercase tracking-[0.12em] text-[#c5d5c8]">
        Inspired living solutions
      </span>
    </div>
  );
}

export function NuhomeSheet({
  kind,
  refLabel,
  refValue,
  date,
  salesman,
  company,
  customer,
  items,
  total,
  notes,
}: {
  kind: "quotation" | "invoice";
  refLabel: string;
  refValue: string;
  date: string;
  salesman?: string | null;
  company: NuhomeSheetCompany;
  customer: {
    name?: string | null;
    firm?: string | null;
    phone?: string | null;
    place?: string | null;
  } | null;
  items: NuhomeSheetLine[];
  total: number;
  notes?: string | null;
}) {
  const legal = company.legal_name || "NUHOME";
  const addressLines = (company.address || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const upiQr = company.upi_id
    ? `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
        `upi://pay?pa=${company.upi_id}&pn=${legal}&am=${total.toFixed(2)}`,
      )}`
    : null;
  const title = kind === "invoice" ? "TAX INVOICE" : "QUOTATION";
  const declarationNoun = kind === "invoice" ? "invoice" : "quotation";

  return (
    <article className="customer-quote nuhome-sheet mx-auto max-w-5xl bg-white px-4 py-5 text-neutral-900 shadow-card print:max-w-none print:shadow-none md:px-8 md:py-8">
      <p className="mb-3 text-center text-[11px] font-semibold tracking-[0.35em] text-neutral-500">
        {title}
      </p>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 text-[13px] leading-6">
          <p className="text-[22px] font-bold uppercase tracking-[0.12em]">{legal}</p>
          {addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {company.phone ? <p>PH: {company.phone}</p> : null}
          {company.gstin ? <p>GSTIN/UIN: {company.gstin}</p> : null}
          <p>
            SALESMAN : {(salesman || "—").toUpperCase()}
          </p>
        </div>
        <NuhomeMark />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-[240px] flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-600">
            Customer details
          </p>
          <FieldRow label="Name" value={customer?.name} />
          <FieldRow
            label="Place/Firm"
            value={customer?.firm || customer?.place}
          />
          <FieldRow label="Phone no" value={customer?.phone} />
        </div>
        <div className="w-48 shrink-0 text-[13px] leading-7">
          <div className="flex justify-between gap-3">
            <span className="font-semibold uppercase">{refLabel}</span>
            <span className="tabular-nums">{refValue}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="font-semibold uppercase">Date</span>
            <span className="tabular-nums">{sheetDate(date)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
              <th className="py-2 pr-2 font-semibold">Sl no</th>
              <th className="py-2 pr-2 font-semibold">Item</th>
              <th className="py-2 pr-2 font-semibold">Code</th>
              <th className="py-2 pr-2 font-semibold">Spec</th>
              <th className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">Rate</th>
              <th className="py-2 pr-2 text-right font-semibold">D/Rate</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="py-6 text-neutral-400" colSpan={8}>
                  No items
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const qty = Number(item.quantity) || 0;
                const rate = Number(item.unit_price) || 0;
                const dRate = dealerRate(item);
                const amount = Number(item.line_total ?? qty * dRate);
                return (
                  <tr key={`${item.description}-${index}`}>
                    <td className="py-2 pr-2 align-top tabular-nums">{index + 1}</td>
                    <td className="py-2 pr-2 align-top">{item.description}</td>
                    <td className="py-2 pr-2 align-top">{item.item_code?.trim() || ""}</td>
                    <td className="py-2 pr-2 align-top text-neutral-700">
                      {displaySpecification(item.specification, item.description)}
                    </td>
                    <td className="py-2 pr-2 align-top text-right tabular-nums">{qty}</td>
                    <td className="py-2 pr-2 align-top text-right tabular-nums">
                      {rate ? formatInrExact(rate) : ""}
                    </td>
                    <td className="py-2 pr-2 align-top text-right tabular-nums">
                      {dRate ? formatInrExact(dRate) : ""}
                    </td>
                    <td className="py-2 align-top text-right tabular-nums">
                      {formatInrExact(amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 bg-[#b7d07a] py-2 text-center text-[15px] font-bold tracking-wide text-neutral-900">
        GRAND TOTAL = {formatInrExact(total)}
      </p>

      <div className="mt-4 space-y-1 text-[12px] leading-6">
        <p>Validity Till 15 days</p>
        <p>Delivery charges extra.</p>
        <p>Packing charges, if applicable, will be additional.</p>
        <p>
          Payment Schedule: 50% advance payment along with the order, 50% at the
          time of delivery.
        </p>
        {notes ? <p className="pt-1">{notes}</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-xl gap-4">
          {upiQr ? (
            <img
              src={upiQr}
              alt="Pay by UPI"
              width={92}
              height={92}
              className="size-[92px] bg-white"
            />
          ) : (
            <div className="size-[92px] bg-neutral-100" aria-hidden />
          )}
          <div className="text-[12px] leading-5">
            <p className="font-semibold uppercase tracking-wide">Declaration</p>
            <p className="mt-1 max-w-sm">
              We declare that this {declarationNoun} shows the actual price of
              the goods described and that all particulars are true and correct.
              Goods once sold will not be taken back.
            </p>
          </div>
        </div>
        <div className="min-w-[180px] text-right text-[12px] leading-6">
          <p className="font-semibold uppercase">{legal}</p>
          {company.bank_name ? <p>{company.bank_name}</p> : null}
          {company.bank_account ? <p>{company.bank_account}</p> : null}
          {company.bank_ifsc ? <p>{company.bank_ifsc}</p> : null}
          {company.bank_branch ? <p>{company.bank_branch}</p> : null}
        </div>
      </div>

      <PrintQuoteButton />
    </article>
  );
}
