// supabase/functions/ashtech-webhook/index.ts
// Called by Ashtech Pay server-to-server (notify_url). Deploy with JWT
// verification OFF — Ashtech cannot send a Supabase auth token.
// This is the ONLY place an order is ever marked confirmed; never trust
// a client-side redirect for that.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/ashtech.ts";
import { sendPushToSubscription } from "../_shared/webpush.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let payload: any;
  try { payload = await req.json(); } catch { return json({ received: true }); }

  // Always ack fast; do the real work after responding.
  const ack = json({ received: true });
  handleEvent(payload).catch((e) => console.error("webhook failed", e));
  return ack;
});

async function handleEvent(payload: any) {
  const { event, reference, total_amount, currency } = payload;
  if (!reference) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return handleOrder(admin, event, reference, total_amount, currency);
}

async function handleOrder(admin: any, event: string, reference: string, total_amount: number, currency: string) {
  const { data: order } = await admin.from("orders").select("*").eq("order_ref", reference).maybeSingle();
  if (!order) return;

  if (event === "payment.failed") {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    await notify(admin, order.buyer_id, "Payment failed", "Your payment could not be completed. Please try again.", "/buyer/orders");
    return;
  }
  if (event !== "payment.completed" || order.status === "confirmed") return;

  const paidEnough = typeof total_amount === "number" && total_amount >= order.final_price && (!currency || currency === order.currency);
  if (!paidEnough) {
    await admin.from("orders").update({ status: "amount_mismatch" }).eq("id", order.id);
    await notify(admin, order.buyer_id, "Payment issue", "We received a payment that didn't match your order amount. Our team will review it.", "/buyer/orders");
    return;
  }

  await admin.from("orders").update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", order.id);

  const { data: items } = await admin.from("order_items").select("*").eq("order_id", order.id);
  if (!items) return;

  for (const item of items) {
    await admin.from("product_events").insert({ product_id: item.product_id, event_type: "purchase" }).catch(() => {});

    // Credit the seller's wallet.
    const { data: sellerRow } = await admin.from("users").select("balance").eq("id", item.seller_id).maybeSingle();
    const newSellerBal = (sellerRow?.balance || 0) + item.seller_credit;
    await admin.from("users").update({ balance: newSellerBal }).eq("id", item.seller_id);
    await admin.from("wallet_transactions").insert({
      user_id: item.seller_id, type: "credit", amount: item.seller_credit,
      balance_after: newSellerBal, description: "Sale: " + item.product_title, order_id: order.id,
    }).catch(() => {});

    // Assign an account slot if this is an account-type product.
    const { data: product } = await admin.from("products").select("type,available_slots").eq("id", item.product_id).maybeSingle();
    if (product?.type === "account") {
      for (let i = 0; i < item.quantity; i++) {
        const { data: slot } = await admin.from("account_slots")
          .select("id").eq("product_id", item.product_id).eq("status", "available").limit(1).maybeSingle();
        if (!slot) break;
        await admin.from("account_slots").update({ status: "assigned", order_id: item.id }).eq("id", slot.id);
        await admin.from("products")
          .update({ available_slots: Math.max(0, (product.available_slots || 1) - (i + 1)) })
          .eq("id", item.product_id);
      }
    }

    // Pay out affiliate commission if this order used an affiliate code.
    if (order.affiliate_code) {
      const { data: affiliate } = await admin.from("affiliates")
        .select("*").eq("affiliate_code", order.affiliate_code).eq("product_id", item.product_id).maybeSingle();
      if (affiliate) {
        const { data: prod } = await admin.from("products").select("affiliate_commission").eq("id", item.product_id).maybeSingle();
        const commission = Math.round(item.unit_price * item.quantity * ((prod?.affiliate_commission || 0) / 100));
        if (commission > 0) {
          await admin.from("affiliate_earnings").insert({
            affiliate_id: affiliate.id, order_id: order.id, order_item_id: item.id,
            commission_amount: commission, status: "pending",
          });
          await admin.from("affiliates").update({
            conversions: affiliate.conversions + 1, total_earned: affiliate.total_earned + commission,
          }).eq("id", affiliate.id);
        }
      }
    }
  }

  // Guest checkout (no buyer_id) — unlock the product portal session so a
  // guest can return later and access what they paid for without an account.
  if (!order.buyer_id && order.buyer_email) {
    for (const item of items) {
      await admin.from("product_sessions")
        .upsert(
          { product_id: item.product_id, email: order.buyer_email, access_granted: true },
          { onConflict: "product_id,email" },
        ).catch(() => {});
    }
  }

  await notify(
    admin, order.buyer_id, "Payment confirmed",
    `Your order ${order.order_ref} was confirmed. Your items are ready.`, "/buyer/orders",
  );
}

async function notify(admin: any, userId: string | null, title: string, body: string, link: string) {
  if (!userId) return;
  await admin.from("notifications").insert({ user_id: userId, type: "order", title, body, link }).catch(() => {});

  // Best-effort Web Push fan-out to all of this user's registered devices.
  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs) return;
  for (const sub of subs) {
    const result = await sendPushToSubscription(sub, { title, body, url: link });
    if (result.shouldRemove) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id).catch(() => {});
    } else {
      await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", sub.id).catch(() => {});
    }
  }
}
