// supabase/functions/ashtech-status/index.ts
// Poll the status of an order's payment (buyer-facing, works for guests too).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, ASHTECH_BASE, json } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("ASHTECH_API_KEY");
  if (!apiKey) return json({ error: "server_misconfigured" }, 500);

  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");
  const guestEmail = url.searchParams.get("email");
  if (!reference) return json({ error: "bad_request", message: "reference is required" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolve caller identity (authenticated buyer, or guest via email match).
  const authHeader = req.headers.get("Authorization") ?? "";
  let callerId: string | null = null;
  if (authHeader) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data } = await userClient.auth.getUser();
    callerId = data?.user?.id ?? null;
  }

  const { data: order } = await admin.from("orders")
    .select("id,buyer_id,buyer_email,status,ashtech_transaction_id,order_ref")
    .eq("order_ref", reference).maybeSingle();
  if (!order) return json({ error: "not_found" }, 404);

  const isOwner = (callerId && order.buyer_id === callerId)
    || (!order.buyer_id && guestEmail && order.buyer_email === guestEmail.toLowerCase());
  if (!isOwner) return json({ error: "forbidden" }, 403);

  if (order.status === "confirmed") {
    const { data: items } = await admin.from("order_items")
      .select("product_title,delivery_link,product_id").eq("order_id", order.id);
    return json({ status: "success", order_status: "confirmed", items: items || [] });
  }
  if (order.status === "failed" || order.status === "amount_mismatch") {
    return json({ status: "failed", order_status: order.status });
  }
  if (!order.ashtech_transaction_id) return json({ status: "pending", order_status: order.status });

  try {
    const res = await fetch(`${ASHTECH_BASE}/v1/transaction/${encodeURIComponent(order.ashtech_transaction_id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    return json({ ...data, order_status: order.status }, res.status);
  } catch (e) {
    return json({ error: "upstream_error", message: String(e) }, 502);
  }
});
