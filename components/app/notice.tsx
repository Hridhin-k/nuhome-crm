export function Notice({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="mb-4 rounded-xl border border-secondary-container bg-secondary-container/60 px-4 py-3 text-[14px] text-on-surface"
    >
      {children}
    </p>
  );
}
