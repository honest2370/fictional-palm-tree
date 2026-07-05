import React from "react";
import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/lib/installPrompt";

export default function InstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = React.useState(() => sessionStorage.getItem("sellizi_install_dismissed") === "1");

  if (!canInstall || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem("sellizi_install_dismissed", "1");
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[900] w-[92%] max-w-sm rounded-2xl bg-slate-900 text-white shadow-xl px-4 py-3 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
        <Download size={18} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold">Install Sellizi</p>
        <p className="text-xs text-slate-300">Add to your home screen for faster access</p>
      </div>
      <button
        onClick={async () => { await promptInstall(); }}
        className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 shrink-0"
      >
        Install
      </button>
      <button onClick={dismiss} className="text-slate-400 hover:text-white shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}
