import Link from "next/link";

export default function PublicQuoteNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-container-low px-4 py-10">
      <div className="max-w-md rounded-xl border border-surface-variant bg-white p-8 text-center shadow-card">
        <h1 className="text-xl font-semibold text-on-surface">
          Quotation unavailable
        </h1>
        <p className="mt-3 text-sm text-on-surface-variant">
          This link may have expired or the quote is no longer available. Contact
          your Nuhome sales representative for an updated quotation.
        </p>
        <p className="mt-6 text-sm font-medium text-primary">Nuhome</p>
      </div>
    </main>
  );
}
