import { sb, FN_BASE, authHeaders } from "./supabase";
import type { LiveCountry } from "@/types";

let _countriesCache: LiveCountry[] | null = null;

/**
 * Always fetch the live list from Ashtech rather than hardcoding it — every
 * hardcoded country/operator list in this app's history has drifted out of
 * sync with what the gateway actually supports.
 */
export async function loadLiveCountries(): Promise<LiveCountry[]> {
  if (_countriesCache) return _countriesCache;
  try {
    const res = await fetch(`${FN_BASE}/ashtech-countries`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    const all = await res.json();
    _countriesCache = Array.isArray(all) ? all : [];
  } catch {
    // Minimal fallback so the UI never shows a completely empty list if the
    // network call fails — does not block any one country from working.
    _countriesCache = [{ code: "CM", name: "Cameroon", currency: "XAF", operators: ["MTN Mobile Money", "Orange Money"] }];
  }
  return _countriesCache;
}

export interface CheckoutParams {
  mode: "single" | "cart";
  product_id?: string; // required when mode === "single"
  discount_code?: string | null;
  guest_email?: string;
  guest_name?: string;
  phone: string;
  operator: string;
  country_code: string;
  currency?: string;
  otp?: string;
  reference?: string | null;
}

export interface CheckoutResponse {
  reference: string;
  flow?: "ussd_push" | "wave" | "otp_sms" | "otp_ussd" | "error";
  wave_url?: string;
  ussd_code?: string | null;
  error?: string;
  message?: string;
  transaction_id?: string;
}

async function postToFunction(path: string, body: Record<string, unknown>): Promise<{ status: number; data: CheckoutResponse }> {
  const headers = await authHeaders();
  const res = await fetch(`${FN_BASE}/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json();
  return { status: res.status, data };
}

/**
 * Buy one product ("Buy now") or the buyer's whole cart via Ashtech Direct
 * API Mobile Money. Price is computed server-side — never send a price
 * from here. This is the ONLY way money moves into the platform; there is
 * no wallet top-up / deposit flow for buyers.
 */
export function initiateCheckout(params: CheckoutParams) {
  return postToFunction("checkout", params);
}

export async function requestWithdrawal(params: {
  amount: number; method: "mtn" | "orange" | "paypal" | "bitcoin";
  account_number?: string; account_name?: string; paypal_email?: string; btc_wallet?: string;
}) {
  const headers = await authHeaders();
  const res = await fetch(`${FN_BASE}/request-withdrawal`, { method: "POST", headers, body: JSON.stringify(params) });
  return { status: res.status, data: await res.json() };
}

export interface StatusResponse {
  status: "pending" | "success" | "failed";
  order_status?: string;
  items?: { product_title: string; delivery_link: string | null; product_id: string }[];
}

export async function checkStatus(reference: string, guestEmail?: string): Promise<StatusResponse> {
  const headers = await authHeaders();
  const qs = new URLSearchParams({ reference, ...(guestEmail ? { email: guestEmail } : {}) });
  const res = await fetch(`${FN_BASE}/ashtech-status?${qs.toString()}`, { headers });
  return res.json();
}

/**
 * Polls payment status every few seconds. Returns a stop() function — call
 * it on unmount/navigation so the interval doesn't leak across screens.
 */
export function pollPaymentStatus(
  reference: string,
  onResult: (result: StatusResponse) => void,
  intervalMs = 4000,
  maxTries = 60,
  guestEmail?: string,
): () => void {
  let tries = 0;
  const interval = setInterval(async () => {
    tries++;
    if (tries > maxTries) {
      clearInterval(interval);
      onResult({ status: "pending" }); // caller should show a "still waiting" message
      return;
    }
    try {
      const result = await checkStatus(reference, guestEmail);
      if (result.status === "success" || result.status === "failed") {
        clearInterval(interval);
        onResult(result);
      }
    } catch {
      // transient network error during polling — just try again next tick
    }
  }, intervalMs);
  return () => clearInterval(interval);
}

export async function fetchSlotCredentials(orderItemId: string) {
  const { data } = await sb
    .from("account_slots")
    .select("platform,cred1_label,cred1_value,cred2_label,cred2_value")
    .eq("order_id", orderItemId)
    .maybeSingle();
  return data;
}
