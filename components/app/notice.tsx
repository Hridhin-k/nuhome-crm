import { Info } from "lucide-react";

export function Notice({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-2 rounded-2xl border border-outline-variant bg-secondary-container/70 px-4 py-3 text-body-sm text-on-surface"
    >
      <Info
        className="mt-0.5 size-4 shrink-0 text-on-secondary-container"
        aria-hidden
      />
      <span>{children}</span>
    </p>
  );
}
