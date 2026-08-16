export function Notice({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="mb-4 rounded-2xl border border-outline-variant bg-secondary-container/70 px-4 py-3 text-body-sm text-on-surface"
    >
      {children}
    </p>
  );
}
