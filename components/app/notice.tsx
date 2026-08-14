export function Notice({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="mb-4 rounded-lg border border-outline-variant bg-secondary-container/50 px-4 py-3 text-body-sm text-on-surface"
    >
      {children}
    </p>
  );
}
