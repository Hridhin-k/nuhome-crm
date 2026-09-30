"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

type Platform = "standalone" | "ios" | "browser";

function readPlatform(): Platform {
  if (isStandalone()) return "standalone";
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "browser";
}

function subscribeDisplayMode(onChange: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function InstallHint() {
  const platform = useSyncExternalStore<Platform | null>(
    subscribeDisplayMode,
    readPlatform,
    () => null,
  );
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const isIOS = platform === "ios";

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || platform === null || platform === "standalone") return null;

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
    setInstallEvent(null);
  }

  return (
    <div className="mb-6 rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
      <p className="text-subheading text-on-surface">Install Nuhome</p>
      {isIOS ? (
        <p className="mt-2 text-body-sm leading-relaxed text-on-surface-variant">
          In Safari, tap Share, then Add to Home Screen. That is the iPhone install path.
        </p>
      ) : (
        <p className="mt-2 text-body-sm leading-relaxed text-on-surface-variant">
          Do not use Add to Home screen — that only saves a bookmark, so Chrome still shows the
          URL bar. Install the app instead. If a bookmark icon is already on your home screen,
          remove it first.
        </p>
      )}
      {installEvent ? (
        <Button type="button" className="mt-4 w-full" size="lg" onClick={() => void install()}>
          Install app
        </Button>
      ) : null}
    </div>
  );
}
