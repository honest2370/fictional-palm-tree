// supabase/functions/_shared/webpush.ts
// Minimal Web Push (VAPID) sender for Deno edge functions.
// Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Uses the "webpush" helper from esm.sh so we don't hand-roll ECDH/AES-GCM.
import webpush from "https://esm.sh/web-push@3.6.7";

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@sellizi.app";
  if (!publicKey || !privateKey) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPushToSubscription(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string; url?: string; icon?: string },
): Promise<{ ok: boolean; statusCode?: number; shouldRemove?: boolean }> {
  ensureConfigured();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e: any) {
    const statusCode = e?.statusCode;
    // 404/410 mean the subscription is gone — caller should delete it.
    const shouldRemove = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, shouldRemove };
  }
}
