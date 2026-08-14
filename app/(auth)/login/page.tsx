import { LoginForm } from "@/app/(auth)/login/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh w-full flex-col bg-primary px-4 py-12">
      <header className="flex justify-center">
        <p className="text-data-tabular tracking-[0.2em] text-on-primary/80 uppercase">
          Nuhome
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <h1 className="text-headline-md text-on-primary">Sign in</h1>
        <p className="mt-3 mb-10 max-w-[280px] text-body-md text-on-primary/80">
          Quotes, payments, and fulfillment — on your phone first.
        </p>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
