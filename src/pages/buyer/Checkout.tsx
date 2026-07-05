import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input, Spinner, showToast } from "@/components/ui";
import { loadLiveCountries, initiateCheckout, pollPaymentStatus } from "@/lib/ashtech";
import { loadCart } from "@/lib/cart";
import type { LiveCountry, Product, CartItem } from "@/types";

type Step = "loading" | "form" | "otp" | "waiting" | "wave" | "success" | "failed";

export default function Checkout() {
  const { slug } = useParams(); // present for "buy now" single-product checkout; absent for cart checkout
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode: "single" | "cart" = slug ? "single" : "cart";

  const [product, setProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<(CartItem & { product: Product })[]>([]);
  const [countries, setCountries] = useState<LiveCountry[]>([]);
  const [countryCode, setCountryCode] = useState("");
  const [operator, setOperator] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [waveUrl, setWaveUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [submitting, setSubmitting] = useState(false);
  const stopPollRef = React.useRef<(() => void) | null>(null);

  useEffect(() => () => { if (stopPollRef.current) stopPollRef.current(); }, []);

  useEffect(() => {
    async function load() {
      const cs = await loadLiveCountries();
      setCountries(cs);
      if (cs.length) setCountryCode(cs[0].code);

      if (mode === "single") {
        const { data } = await sb.from("products").select("*").eq("slug", slug).maybeSingle();
        setProduct(data as Product);
      } else {
        if (!user) { navigate("/buyer/login"); return; }
        const items = await loadCart(user.id);
        if (items.length === 0) { showToast("Your cart is empty", "error"); navigate("/buyer/cart"); return; }
        setCartItems(items);
      }
      setStep("form");
    }
    load();
  }, [slug, mode, user?.id]);

  const selectedCountry = countries.find((c) => c.code === countryCode);
  const operators = selectedCountry?.operators || [];

  useEffect(() => {
    if (operators.length && !operators.includes(operator)) setOperator(operators[0]);
  }, [countryCode, operators]);

  const displayTotal = mode === "single"
    ? (product?.price ?? 0)
    : cartItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const displayCurrency = mode === "single" ? product?.currency : cartItems[0]?.product.currency;

  async function submit(otpValue?: string) {
    if (!phone || !operator || !countryCode) { showToast("Fill in your phone number", "error"); return; }
    if (!user && (!guestName || !guestEmail)) { showToast("Enter your name and email", "error"); return; }

    setSubmitting(true);
    const { status, data } = await initiateCheckout({
      mode,
      product_id: mode === "single" ? product?.id : undefined,
      discount_code: discountCode || null,
      guest_name: user ? undefined : guestName,
      guest_email: user ? undefined : guestEmail,
      phone, operator, country_code: countryCode, currency: selectedCountry?.currency,
      otp: otpValue, reference,
    });
    setSubmitting(false);
    setReference(data.reference);

    if (data.flow === "wave") {
      setWaveUrl(data.wave_url || null);
      setStep("wave");
      startPolling(data.reference);
    } else if (data.flow === "ussd_push") {
      setStep("waiting");
      startPolling(data.reference);
    } else if (data.flow === "otp_ussd" || data.flow === "otp_sms") {
      setUssdCode(data.ussd_code || null);
      setStep("otp");
    } else {
      showToast(data.message || "Payment could not be started", "error");
    }
  }

  function startPolling(ref: string) {
    stopPollRef.current = pollPaymentStatus(ref, (result) => {
      if (result.status === "success") {
        setStep("success");
        setTimeout(() => navigate(user ? "/buyer/orders" : "/"), 1800);
      } else if (result.status === "failed") {
        setStep("failed");
      }
    }, 4000, 60, guestEmail || undefined);
  }

  if (step === "loading" || (mode === "single" && !product)) {
    return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;
  }

  return (
    <div className="p-4 pb-28">
      <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-semibold mb-4">← Back</button>

      <div className="bg-slate-50 rounded-2xl p-4 mb-5">
        {mode === "single" ? (
          <>
            <p className="text-xs text-slate-500 mb-1">Paying for</p>
            <p className="font-bold text-slate-900">{product!.title}</p>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-1">{cartItems.length} item(s) in cart</p>
            {cartItems.map((i) => <p key={i.id} className="text-sm text-slate-700">{i.product.title} × {i.quantity}</p>)}
          </>
        )}
        <p className="text-blue-600 font-extrabold text-lg mt-1">{displayTotal.toLocaleString()} {displayCurrency}</p>
      </div>

      {step === "form" && (
        <>
          {!user && (
            <>
              <Input label="Your name" value={guestName} onChange={setGuestName} placeholder="Full name" />
              <Input label="Your email" value={guestEmail} onChange={setGuestEmail} placeholder="you@email.com" type="email" />
            </>
          )}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Country</label>
            <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase">Operator</label>
            <select value={operator} onChange={(e) => setOperator(e.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">
              {operators.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <Input label="Phone number" value={phone} onChange={setPhone} placeholder="e.g. 670000000" type="tel" />
          <Input label="Discount code (optional)" value={discountCode} onChange={setDiscountCode} placeholder="SAVE10" />

          <Button fullWidth disabled={submitting} onClick={() => submit()} className="mt-2">
            {submitting ? "Processing…" : `Pay ${displayTotal.toLocaleString()} ${displayCurrency}`}
          </Button>
        </>
      )}

      {step === "otp" && (
        <>
          <p className="text-sm text-slate-600 mb-3">
            {ussdCode ? <>Dial <strong>{ussdCode}</strong> on your phone to get your code.</> : "Enter the OTP code you received by SMS."}
          </p>
          <Input value={otp} onChange={setOtp} placeholder="123456" />
          <Button fullWidth disabled={submitting} onClick={() => submit(otp)}>{submitting ? "Confirming…" : "Confirm"}</Button>
        </>
      )}

      {step === "waiting" && (
        <div className="text-center py-10">
          <Spinner className="text-blue-600 mx-auto mb-4" />
          <p className="font-bold text-slate-900 mb-1">Check your phone</p>
          <p className="text-sm text-slate-500">Approve the Mobile Money prompt sent to your phone.</p>
        </div>
      )}

      {step === "wave" && waveUrl && (
        <div className="text-center py-10">
          <p className="font-bold text-slate-900 mb-4">Pay with Wave</p>
          <Button fullWidth onClick={() => window.open(waveUrl, "_blank")}>Open Wave</Button>
        </div>
      )}

      {step === "success" && (
        <div className="text-center py-10">
          <p className="text-emerald-600 font-extrabold text-lg mb-1">Payment confirmed! 🎉</p>
          <p className="text-sm text-slate-500">Redirecting…</p>
        </div>
      )}

      {step === "failed" && (
        <div className="text-center py-10">
          <p className="text-red-600 font-extrabold text-lg mb-2">Payment failed</p>
          <Button fullWidth onClick={() => { setStep("form"); setReference(null); }}>Try again</Button>
        </div>
      )}
    </div>
  );
}
