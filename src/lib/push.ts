import { useEffect, useState, useCallback } from "react";
import { FN_BASE, authHeaders } from "./supabase";

// Public VAPID key — safe to expose in the client. Set at build time via
// VITE_VAPID_PUBLIC_KEY (matches VAPID_PUBLIC_KEY used by the edge functions).
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function sendSubscriptionToServer(action: "subscribe" | "unsubscribe", subscription: PushSubscription) {
  const headers = await authHeaders();
  const res = await fetch(`${FN_BASE}/push-subscribe`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, subscription: subscription.toJSON() }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to update notification settings");
}

/** React hook: exposes push notification support/subscription state and actions. */
export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isSupported = "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
    setSupported(isSupported);
    if (!isSupported) { setLoading(false); return; }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .finally(() => setLoading(false));
  }, []);

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) throw new Error("Push notifications are not configured");
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await sendSubscriptionToServer("subscribe", sub);
      setSubscribed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sendSubscriptionToServer("unsubscribe", sub);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  return { supported, subscribed, loading, subscribe, unsubscribe };
}
