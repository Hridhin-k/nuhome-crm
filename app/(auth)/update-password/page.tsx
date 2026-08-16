import { UpdatePasswordForm } from "@/app/(auth)/update-password/update-form";

export default function UpdatePasswordPage() {
  return (
    <main className="flex min-h-dvh w-full flex-col bg-primary px-4 py-12">
      <header className="flex justify-center">
        <p className="text-data-tabular tracking-[0.2em] text-on-primary/80 uppercase">
          Nuhome
        </p>
      </header>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <h1 className="text-headline-md text-on-primary">Set a new password</h1>
        <p className="mt-3 mb-10 max-w-[280px] text-body-md text-on-primary/80">
          Choose a password at least 8 characters long.
        </p>
        <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <UpdatePasswordForm />
        </div>
      </div>
    </main>
  );
}
