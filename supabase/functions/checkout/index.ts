// supabase/functions/checkout/index.ts
// Creates an order (from the buyer's cart, or a single product for guest/
// "buy now" flows) and immediately initiates an Ashtech Direct API collect.
// This is the ONLY way money moves in from a buyer — there is no deposit/
// top-up flow. Sellers are credited only once the webhook confirms payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json, getCurrencyForCountry, collect, shapeCollectResponse } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SELLER_SHARE = 0.85; // seller keeps 85%, platform keeps 15%

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("ASHTECH_API_KEY");
  if (!apiKey) return json({ error: "server_misconfigured" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const {
    mode,                // "cart" | "single"
    product_id,          // required if mode === "single"
    discount_code,
    guest_email, guest_name, // required for guest checkout (no auth header)
    phone, operator, country_code, currency: clientCurrency, otp,
    reference: existingReference,
  } = body;

  if (!phone || !operator || !country_code) {
    return json({ error: "bad_request", message: "phone, operator and country_code are required" }, 400);
  }
  const currency = clientCurrency || await getCurrencyForCountry(apiKey, country_code);
  if (!currency) return json({ error: "unprocessable", message: "Country not supported." }, 422);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ---- Resolve buyer (if authenticated) ----
  const authHeader = req.headers.get("Authorization") ?? "";
  let buyer: { id: string; name: string; email: string; phone: string } | null = null;
  if (authHeader) {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) {
      const { data: row } = await admin.from("users").select("id,name,email,phone,role").eq("id", userData.user.id).maybeSingle();
      if (row) {
        if (row.role !== "buyer") return json({ error: "forbidden", message: "Only buyer accounts can purchase." }, 403);
        buyer = { id: row.id, name: row.name, email: row.email, phone: row.phone };
      }
    }
  }
  if (!buyer && (!guest_email || !guest_name)) {
    return json({ error: "bad_request", message: "guest_email and guest_name are required for guest checkout" }, 400);
  }

  // ---- Resuming a payment already initiated (retry / OTP step 2) ----
  if (existingReference) {
    const { data: existingOrder } = await admin.from("orders")
      .select("id,final_price,status")
      .eq("order_ref", existingReference)
      .eq(buyer ? "buyer_id" : "buyer_email", buyer ? buyer.id : String(guest_email).toLowerCase())
      .maybeSingle();
    if (!existingOrder) return json({ error: "not_found" }, 404);
    if (existingOrder.status === "confirmed") return json({ error: "already_paid" }, 409);
    return respondWithCollect(admin, apiKey, existingReference, existingOrder.final_price, currency, phone, operator, country_code, otp);
  }

  // ---- Build line items ----
  type Line = { product: any; quantity: number };
  const lines: Line[] = [];

  if (mode === "single") {
    if (!product_id) return json({ error: "bad_request", message: "product_id is required" }, 400);
    const { data: product, error } = await admin.from("products")
      .select("id,title,price,discount_percent,discount_until,cover_url,delivery_link,seller_id,seller_name,status,type,currency")
      .eq("id", product_id).maybeSingle();
    if (error || !product) return json({ error: "not_found", message: "Product not found" }, 404);
    if (product.status !== "approved") return json({ error: "unprocessable", message: "Product not available" }, 422);
    lines.push({ product, quantity: 1 });
  } else {
    if (!buyer) return json({ error: "bad_request", message: "Cart checkout requires an authenticated buyer" }, 400);
    const { data: cart } = await admin.from("carts").select("id").eq("buyer_id", buyer.id).maybeSingle();
    if (!cart) return json({ error: "bad_request", message: "Cart is empty" }, 400);
    const { data: items } = await admin.from("cart_items")
      .select("quantity, product:product_id(id,title,price,discount_percent,discount_until,cover_url,delivery_link,seller_id,seller_name,status,type,currency)")
      .eq("cart_id", cart.id);
    if (!items || items.length === 0) return json({ error: "bad_request", message: "Cart is empty" }, 400);
    for (const item of items as any[]) {
      if (item.product?.status !== "approved") continue;
      lines.push({ product: item.product, quantity: item.quantity });
    }
    if (lines.length === 0) return json({ error: "unprocessable", message: "No purchasable items in cart" }, 422);
  }

  // ---- Stock check for account-type products ----
  for (const line of lines) {
    if (line.product.type === "account") {
      const { count } = await admin.from("account_slots").select("id", { count: "exact", head: true })
        .eq("product_id", line.product.id).eq("status", "available");
      if (!count || count < line.quantity) {
        return json({ error: "unprocessable", message: `"${line.product.title}" is out of stock` }, 422);
      }
    }
  }

  // ---- Pricing ----
  function unitPrice(p: any) {
    return p.discount_percent && p.discount_until && new Date(p.discount_until) > new Date()
      ? Math.round(p.price * (1 - p.discount_percent / 100))
      : p.price;
  }

  let subtotal = 0;
  const priced = lines.map((l) => {
    const unit = unitPrice(l.product);
    subtotal += unit * l.quantity;
    return { ...l, unit };
  });

  let discountAmt = 0;
  let appliedCode: string | null = null;
  let discountRow: any = null;

  if (discount_code) {
    const code = String(discount_code).trim().toUpperCase();
    const { data: dc } = await admin.from("discount_codes").select("*").eq("code", code).eq("is_active", true).maybeSingle();
    const singleProductId = mode === "single" ? lines[0].product.id : null;
    if (dc && (!dc.valid_until || new Date(dc.valid_until) >= new Date())
        && dc.used_count < dc.max_uses
        && (!dc.product_id || dc.product_id === singleProductId)) {
      discountAmt = Math.round(subtotal * dc.discount_percent / 100);
      appliedCode = dc.code;
      discountRow = dc;
    }
  }

  const finalPrice = subtotal - discountAmt;
  const orderRef = "DS-" + Math.random().toString(36).substring(2, 10).toUpperCase();

  const { data: insertedOrder, error: orderErr } = await admin.from("orders").insert({
    order_ref: orderRef,
    buyer_id: buyer?.id ?? null,
    buyer_name: buyer?.name ?? guest_name,
    buyer_email: (buyer?.email ?? guest_email).toLowerCase(),
    buyer_phone: buyer?.phone ?? null,
    subtotal, discount_code: appliedCode, discount_amount: discountAmt,
    final_price: finalPrice, currency,
    payment_method: "ashtech", status: "awaiting_payment",
    source: mode === "cart" ? "cart_checkout" : "buy_now",
  }).select("id").single();

  if (orderErr || !insertedOrder) return json({ error: "server_error", message: orderErr?.message }, 500);

  const orderItemRows = priced.map((l) => ({
    order_id: insertedOrder.id,
    product_id: l.product.id,
    product_title: l.product.title,
    product_cover: l.product.cover_url,
    unit_price: l.unit,
    quantity: l.quantity,
    seller_id: l.product.seller_id,
    seller_name: l.product.seller_name,
    seller_credit: Math.round(l.unit * l.quantity * SELLER_SHARE * (1 - discountAmt / Math.max(subtotal, 1))),
    delivery_link: l.product.delivery_link,
  }));
  await admin.from("order_items").insert(orderItemRows);

  if (discountRow) {
    await admin.from("discount_codes").update({ used_count: discountRow.used_count + 1 }).eq("id", discountRow.id);
  }

  // Clear the cart now that it has been converted into an order.
  if (mode === "cart" && buyer) {
    const { data: cart } = await admin.from("carts").select("id").eq("buyer_id", buyer.id).maybeSingle();
    if (cart) await admin.from("cart_items").delete().eq("cart_id", cart.id);
  }

  // Note: "purchase" analytics events are recorded by the webhook only once
  // payment is actually confirmed — recording them here (at awaiting_payment)
  // would double-count failed/abandoned checkouts as purchases.

  return respondWithCollect(admin, apiKey, orderRef, finalPrice, currency, phone, operator, country_code, otp);
});

async function respondWithCollect(
  admin: any, apiKey: string, reference: string, amount: number, currency: string,
  phone: string, operator: string, country_code: string, otp?: string,
) {
  const result = await collect(apiKey, {
    amount, currency, phone, operator, country_code, reference, otp,
    notify_url: `${SUPABASE_URL}/functions/v1/ashtech-webhook`,
  });

  if (result.data?.transaction_id) {
    await admin.from("orders")
      .update({ ashtech_transaction_id: result.data.transaction_id, ashtech_operator: operator, ashtech_country_code: country_code, ashtech_phone: phone })
      .eq("order_ref", reference);
  }

  const shaped = shapeCollectResponse(result, reference);
  return json(shaped, result.status === 400 ? 200 : result.status); // OTP-required is a normal step, not a client error
}
