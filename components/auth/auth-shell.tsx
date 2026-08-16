import type { ReactNode } from "react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-[#09090b] px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_100%_0%,rgba(99,102,241,0.35),transparent_55%)]"
      />
      <header className="relative flex justify-center">
        <p className="text-data-tabular tracking-[0.2em] text-white/80 uppercase">
          Nuhome
        </p>
      </header>
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <h1 className="text-[32px] leading-none font-bold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-3 mb-10 max-w-[280px] text-body-md text-white/70">
          {description}
        </p>
        <div className="rounded-2xl border border-white/12 bg-white p-4 shadow-card">
          {children}
        </div>
      </div>
    </main>
  );
}
