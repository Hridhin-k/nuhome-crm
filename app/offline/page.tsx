import { AppLink } from "@/components/app/app-link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <p className="text-data-tabular tracking-[0.2em] text-on-surface-variant uppercase">
        Nuhome
      </p>
      <h1 className="mt-4 text-headline-md text-on-surface">You’re offline</h1>
      <p className="mt-3 text-body-md leading-relaxed text-on-surface-variant">
        Quotes, payments, and fulfillment need a connection. We’ll retry as soon as you’re back.
      </p>
      <AppLink
        href="/home"
        className="mt-8 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-subheading text-on-primary"
      >
        Try again
      </AppLink>
    </main>
  );
}
