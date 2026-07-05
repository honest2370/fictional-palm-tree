// supabase/functions/push-subscribe/index.ts
// Registers or removes a browser's Web Push subscription for the logged-in user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return json({ error: "unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { action, subscription } = body; // action: "subscribe" | "unsubscribe"

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (action === "unsubscribe") {
    if (!subscription?.endpoint) return json({ error: "bad_request" }, 400);
    await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await admin.from("users").update({ push_enabled: false }).eq("id", userData.user.id);
    return json({ success: true });
  }

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return json({ error: "bad_request", message: "Invalid push subscription payload" }, 400);
  }

  const { error: upsertErr } = await admin.from("push_subscriptions").upsert({
    user_id: userData.user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    user_agent: req.headers.get("user-agent") || null,
    last_used_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (upsertErr) return json({ error: "server_error", message: upsertErr.message }, 500);

  await admin.from("users").update({ push_enabled: true }).eq("id", userData.user.id);
  return json({ success: true });
});
