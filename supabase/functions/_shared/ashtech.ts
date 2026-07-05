// supabase/functions/_shared/ashtech.ts
// Shared helpers for the Ashtech Pay DIRECT API (SDK) integration.
// Docs: Ashtech Pay Direct API v1 — https://ashtechpay.top
// Covers the 16-country Mobile Money network: USSD Push, OTP SMS,
// OTP USSD, and Wave flows via POST /v1/collect.

export const ASHTECH_BASE = "https://ashtechpay.top";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  operators: string[];
}

/** GET /v1/countries — used to resolve currency + validate operator/country pairs. */
export async function fetchCountries(apiKey: string): Promise<CountryInfo[]> {
  const res = await fetch(`${ASHTECH_BASE}/v1/countries`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getCurrencyForCountry(apiKey: string, countryCode: string): Promise<string | null> {
  const countries = await fetchCountries(apiKey);
  const match = countries.find((c) => c.code === countryCode);
  return match?.currency ?? null;
}

export interface CollectParams {
  amount: number;
  currency: string;
  phone: string;
  operator: string;
  country_code: string;
  reference: string;
  notify_url: string;
  otp?: string;
}

export interface CollectResult {
  status: number;
  data: any;
}

/** POST /v1/collect — initiate a Mobile Money payment. Handles all 4 flows
 *  (USSD Push, OTP SMS, OTP USSD, Wave) by simply forwarding Ashtech's response;
 *  the caller (edge function) decides how to shape the client-facing reply. */
export async function collect(apiKey: string, params: CollectParams): Promise<CollectResult> {
  const res = await fetch(`${ASHTECH_BASE}/v1/collect`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** GET /v1/transaction/:id — poll a transaction's current status. */
export async function getTransaction(apiKey: string, transactionId: string): Promise<CollectResult> {
  const res = await fetch(`${ASHTECH_BASE}/v1/transaction/${encodeURIComponent(transactionId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export interface FeeInfo {
  country_code: string;
  country_name: string;
  currency: string;
  deposit_fee_pct: number;
  withdrawal_fee_pct: number;
  transfer_fee_pct: number;
  total_fee_pct: number;
}

/** GET /v1/fees — real-time fee grid, used only to show buyers/sellers a net estimate. */
export async function fetchFees(apiKey: string): Promise<FeeInfo[]> {
  const res = await fetch(`${ASHTECH_BASE}/v1/fees`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  return res.json();
}

/** Shapes an Ashtech /v1/collect response into a flow the frontend can render:
 *  ussd_push | wave | otp_sms | otp_ussd | error */
export function shapeCollectResponse(result: CollectResult, reference: string) {
  const { status, data } = result;

  if (status === 202 && data?.flow === "wave") {
    return { flow: "wave", reference, transaction_id: data.transaction_id, wave_url: data.wave_url };
  }
  if (status === 202) {
    return { flow: "ussd_push", reference, transaction_id: data.transaction_id };
  }
  if (status === 400 && data?.error === "otp_required") {
    if (data.ussd_code) {
      return { flow: "otp_ussd", reference, ussd_code: data.ussd_code, message: data.message };
    }
    return { flow: "otp_sms", reference, message: data.message };
  }
  return { flow: "error", reference, error: data?.error || "upstream_error", message: data?.message || "Payment could not be initiated." };
}
