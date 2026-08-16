"use client";

import { useOffline } from "next/offline";

export function OfflineBanner() {
  const isOffline = useOffline();

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="bg-warning-container px-4 py-2 text-center text-body-sm text-on-warning print:hidden"
    >
      You’re offline. Changes will retry when the connection returns.
    </div>
  );
}
