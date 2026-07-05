import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event("sellizi:install-available"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as any).standalone === true;
}

/** React hook for the "Install app" banner/button. */
export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onAvailable = () => setCanInstall(true);
    const onInstalled = () => { setInstalled(true); setCanInstall(false); };
    window.addEventListener("sellizi:install-available", onAvailable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("sellizi:install-available", onAvailable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return choice.outcome;
  }, []);

  return { canInstall: canInstall && !installed, installed, promptInstall };
}
