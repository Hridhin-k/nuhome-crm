export default function PublicQuoteNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="max-w-md rounded-2xl border border-outline-variant bg-card p-8 shadow-card text-center">
        <h1 className="text-headline-md text-on-surface">
          Quotation unavailable
        </h1>
        <p className="mt-3 text-body-sm text-on-surface-variant">
          This link may have expired or the quote is no longer available. Contact
          your Nuhome sales representative for an updated quotation.
        </p>
        <p className="mt-6 text-sm font-medium text-primary">Nuhome</p>
      </div>
    </main>
  );
}
