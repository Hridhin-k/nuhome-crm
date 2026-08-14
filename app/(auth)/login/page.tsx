import { LoginForm } from "@/app/(auth)/login/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh w-full flex-col justify-center bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <p className="text-label-md text-on-surface-variant uppercase">
          Nuhome
        </p>
        <h1 className="text-display-lg mt-3 text-on-surface">Sign in</h1>
        <p className="text-body-lg mt-3 mb-8 text-on-surface-variant">
          Quotes, payments, and fulfillment — on your phone first.
        </p>
        <div className="rounded-xl border border-surface-variant bg-surface-container-lowest p-6 shadow-card">
          <LoginForm next={next} />
        </div>
      </div>
    </main>
  );
}
