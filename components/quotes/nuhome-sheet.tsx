import { PrintQuoteButton } from "@/components/quotes/print-quote-button";
import { formatInrExact } from "@/lib/format/money";
import { formatIstDate } from "@/lib/format/date";
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
  return formatIstDate(date);
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
    <div className="flex gap-3 text-[12px] font-semibold leading-6">
      <span className="w-28 shrink-0 font-bold uppercase tracking-wide text-neutral-800">
        {label}
      </span>
      <span className="min-w-0 flex-1 font-semibold text-neutral-800">{value || " "}</span>
    </div>
  );
}

function NuhomeMark() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/quote/nuhome logo.jpg"
      alt="NUHOME"
      className="h-[90px] w-auto shrink-0 object-contain sm:h-[130px] print:h-[130px]"
    />
    // <div className="flex size-[118px] shrink-0 flex-col items-center justify-center bg-[#154734] text-center text-[#d4af37]">
    //   <span className="text-[42px] font-bold leading-none tracking-tight">N</span>
    //   <span className="mt-1 text-[11px] font-bold tracking-[0.28em] text-white">
    //     NUHOME
    //   </span>
    //   <span className="mt-0.5 px-2 text-[7px] uppercase tracking-[0.12em] text-[#c5d5c8]">
    //     Inspired living solutions
    //   </span>
    // </div>
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
  const title = kind === "invoice" ? "TAX INVOICE" : "QUOTATION";
  const declarationNoun = kind === "invoice" ? "invoice" : "quotation";

  return (
    <article className="customer-quote nuhome-sheet mx-auto max-w-5xl bg-white px-4 py-5 font-semibold text-neutral-900 shadow-card print:max-w-none print:shadow-none md:px-8 md:py-8">
      {/* <p className="mb-3 text-center text-[11px] font-bold tracking-[0.35em] text-neutral-500">
        {title}
      </p> */}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-[11px] font-semibold leading-5 sm:text-[13px] sm:leading-6 print:text-[13px] print:leading-6">
          <p className="text-[18px] font-bold uppercase tracking-[0.12em] sm:text-[22px] print:text-[22px]">{legal}</p>
          {addressLines.map((line) => (
            <p key={line} className="font-semibold">{line}</p>
          ))}
          {company.phone ? <p className="font-semibold">PH: {company.phone}</p> : null}
          {company.gstin ? <p className="font-semibold">GSTIN/UIN: {company.gstin}</p> : null}
          <p className="font-semibold">
            SALESMAN : {(salesman || "—").toUpperCase()}
          </p>
        </div>
        <NuhomeMark />
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 print:min-w-[240px]">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] sm:text-[13px] print:text-[13px]">
            Customer details
          </p>
          <FieldRow label="Name" value={customer?.name} />
          <FieldRow
            label="Place/Firm"
            value={customer?.firm || customer?.place}
          />
          <FieldRow label="Phone no" value={customer?.phone} />
        </div>
        <div className="w-full shrink-0 text-[11px] font-semibold leading-6 sm:w-48 sm:text-[13px] sm:leading-7 print:w-48 print:text-[13px] print:leading-7">
          <div className="flex justify-between gap-3">
            <span className="font-bold uppercase">{refLabel}</span>
            <span className="tabular-nums font-semibold">{refValue}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="font-bold uppercase">Date</span>
            <span className="tabular-nums font-semibold">{sheetDate(date)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[640px] border-collapse border border-neutral-400 text-left text-[12px] font-semibold print:min-w-0 print:text-[10px]">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[28%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[7%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead>
            <tr className="bg-neutral-100 text-[11px] font-bold uppercase tracking-wide text-neutral-800 print:text-[9px]">
              <th className="border border-neutral-400 px-2 py-2 text-center font-bold print:px-1">Sl no</th>
              <th className="border border-neutral-400 px-2 py-2 font-bold print:px-1">Item</th>
              <th className="border border-neutral-400 px-2 py-2 font-bold print:px-1">Code</th>
              <th className="border border-neutral-400 px-2 py-2 font-bold print:px-1">Spec</th>
              <th className="border border-neutral-400 px-2 py-2 text-right font-bold print:px-1">Qty</th>
              <th className="border border-neutral-400 px-2 py-2 text-right font-bold print:px-1">Rate</th>
              <th className="border border-neutral-400 px-2 py-2 text-right font-bold print:px-1">D/Rate</th>
              <th className="border border-neutral-400 px-2 py-2 text-right font-bold print:px-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="border border-neutral-400 px-2 py-6 text-center font-semibold text-neutral-400" colSpan={8}>
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
                    <td className="border border-neutral-300 px-2 py-2 align-top text-center tabular-nums font-semibold print:px-1">{index + 1}</td>
                    <td className="border border-neutral-300 px-2 py-2 align-top font-semibold text-neutral-900 print:px-1">{item.description}</td>
                    <td className="border border-neutral-300 px-2 py-2 align-top font-semibold text-neutral-700 print:px-1">{item.item_code?.trim() || ""}</td>
                    <td className="border border-neutral-300 px-2 py-2 align-top font-semibold text-neutral-700 print:px-1">
                      {displaySpecification(item.specification, item.description)}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 align-top text-right tabular-nums font-semibold print:px-1">{qty}</td>
                    <td className="border border-neutral-300 px-2 py-2 align-top text-right tabular-nums font-semibold print:px-1">
                      {rate ? formatInrExact(rate) : ""}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 align-top text-right tabular-nums font-semibold print:px-1">
                      {dRate ? formatInrExact(dRate) : ""}
                    </td>
                    <td className="border border-neutral-300 px-2 py-2 align-top text-right tabular-nums font-bold text-neutral-900 print:px-1">
                      {formatInrExact(amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="border-b border-l border-r bg-[#C5E0B3] py-2 text-center text-[15px] font-bold tracking-wide text-neutral-900">
        GRAND TOTAL = {formatInrExact(total)}/-
      </p>

      <div className="mt-4 space-y-1 text-[12px] font-semibold leading-6">
        <p className="font-semibold">Validity Till 15 days</p>
        <p className="font-semibold">Delivery charges extra.</p>
        <p className="font-semibold">Packing charges, if applicable, will be additional.</p>
        <p className="font-semibold">
          Payment Schedule: 50% advance payment along with the order, 50% at the
          time of delivery.
        </p>
        {notes ? <p className="pt-1 font-semibold">{notes}</p> : null}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-6 font-semibold">
        <div className="flex max-w-xl gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/quote/nuhome-qr.png"
            alt="Pay by UPI"
            width={200}
            height={200}
            className="size-[100px] bg-white object-contain"
          />
          <div className="text-[12px] font-semibold leading-5">
            <p className="font-bold uppercase tracking-wide mt-2">Declaration</p>
            <p className="mt-1 max-w-sm font-semibold">
              We declare that this {declarationNoun} shows the actual price of
              the goods described and that all particulars are true and correct.
              Goods once sold will not be taken back.
            </p>
          </div>
        </div>
        <div className="min-w-[180px] ml-auto text-right text-[12px] font-semibold leading-6">
          <p className="font-bold uppercase">{legal}</p>
          {company.bank_name ? <p className="font-semibold">{company.bank_name}</p> : null}
          {company.bank_account ? <p className="font-semibold">{company.bank_account}</p> : null}
          {company.bank_ifsc ? <p className="font-semibold">{company.bank_ifsc}</p> : null}
          {company.bank_branch ? <p className="font-semibold">{company.bank_branch}</p> : null}
        </div>
      </div>

      <PrintQuoteButton />
    </article>
  );
}
