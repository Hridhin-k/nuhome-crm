"use client";

import { useEffect, useState } from "react";

export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    if (standalone) return;

    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-lg border border-outline-variant bg-card p-4 shadow-card">
      <p className="text-subheading text-on-surface">Install Nuhome</p>
      {isIOS ? (
        <p className="mt-2 text-body-sm leading-relaxed text-on-surface-variant">
          Tap Share, then Add to Home Screen. Nuhome opens like an app, without the browser chrome.
        </p>
      ) : (
        <p className="mt-2 text-body-sm leading-relaxed text-on-surface-variant">
          Use your browser’s Install or Add to Home Screen option. After that, Nuhome launches in its own window.
        </p>
      )}
    </div>
  );
}
