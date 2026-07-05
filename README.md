# Sellizi v3

A buyer/seller marketplace for digital products, courses, and accounts,
paid for exclusively via **Ashtech Pay Direct API** (Mobile Money, 16
African countries). Installable as a PWA with Web Push notifications, and
built out for SEO (sitemap, JSON-LD, storefronts, blog).

Built with Vite + React + TypeScript + Tailwind v4, backed by Supabase
(Postgres + Auth + Edge Functions).

## What's included

- **Buyer**: browse by category, search, wishlist, multi-item cart,
  single-item "buy now", guest checkout, reviews, order history.
- **Seller**: product CRUD (digital/account/course/service), account-slot
  inventory, course curriculum builder, storefront customization
  (logo/banner/bio/theme), affiliate program per product, wallet +
  withdrawals, sales dashboard.
- **Payments**: Ashtech Pay Direct API only — no deposit/top-up flow.
  Buyers pay per-order (USSD Push, OTP SMS, OTP USSD, Wave). Sellers earn
  into a wallet and withdraw manually (MTN, Orange, PayPal, Bitcoin).
- **PWA**: installable from the browser (manifest + service worker),
  offline app-shell caching, Web Push (VAPID) for order/payout
  notifications.
- **SEO**: per-page meta tags + Open Graph + Twitter cards, JSON-LD
  (Product, BreadcrumbList, Organization), dynamic `sitemap.xml`,
  `robots.txt`, seller storefronts and category pages that are all
  server-crawlable.

Not yet built as a UI (schema is ready): admin moderation panel, blog
CMS editor (table + public reading exists), seo_redirects management
screen. These are flagged so nothing is silently missing.

## 1. Supabase setup

1. Create a Supabase project.
2. In the SQL Editor, run the four migration files **in order**, each as
   its own query, top to bottom:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_triggers.sql`
   - `supabase/migrations/0004_seed.sql`
3. Deploy the edge functions (Supabase CLI):
   ```bash
   supabase functions deploy checkout
   supabase functions deploy ashtech-webhook --no-verify-jwt
   supabase functions deploy ashtech-status
   supabase functions deploy ashtech-countries
   supabase functions deploy request-withdrawal
   supabase functions deploy push-subscribe
   supabase functions deploy sitemap --no-verify-jwt
   ```
   `ashtech-webhook` and `sitemap` **must** be deployed with
   `--no-verify-jwt` — Ashtech's servers and search engine crawlers can't
   send a Supabase auth token.
4. Set Edge Function secrets:
   ```bash
   supabase secrets set ASHTECH_API_KEY=your_ashtech_direct_api_key
   supabase secrets set VAPID_PUBLIC_KEY=your_vapid_public_key
   supabase secrets set VAPID_PRIVATE_KEY=your_vapid_private_key
   supabase secrets set VAPID_SUBJECT=mailto:support@yourdomain.com
   supabase secrets set SITE_URL=https://yourdomain.com
   ```
   Generate a VAPID key pair with `npx web-push generate-vapid-keys`.
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided by
   Supabase — do not set them yourself.
5. In **Authentication → URL Configuration**, add your production domain.

## 2. App environment

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_VAPID_PUBLIC_KEY=...   # same value as VAPID_PUBLIC_KEY above
```

## 3. Local development

```bash
npm install
npm run dev
```

## 4. Deploying (Vercel)

`vercel.json` already handles the SPA fallback and rewrites `/sitemap.xml`
to the edge function — **update the placeholder project ref** in
`vercel.json` to your actual Supabase project ref before deploying.

Before going live:
- Replace the placeholder PWA icons in `public/icons/` and
  `public/og-default.png` with real branded assets (192×192, 512×512, plus
  maskable variants — see `public/manifest.webmanifest`).
- Set `google-site-verification` in `index.html` to your real Search
  Console token.
- Update `SITE_URL` throughout (`index.html`, `robots.txt`,
  `site_settings` table, edge function secret) to your real domain.
- Submit `https://yourdomain.com/sitemap.xml` to Google Search Console.

## 5. How payments work

1. Buyer taps "Buy now" or checks out their cart.
2. The `checkout` edge function creates an `orders` row (+ one
   `order_items` row per product) with `status = 'awaiting_payment'`,
   then calls Ashtech's `POST /v1/collect`.
3. Depending on the operator, the buyer either approves a USSD prompt,
   enters an OTP, or opens a Wave link — the frontend polls
   `ashtech-status` until Ashtech confirms.
4. Ashtech calls `ashtech-webhook` server-to-server when the payment
   settles. This is the **only** place an order is marked `confirmed`,
   sellers are credited, account slots are assigned, and affiliate
   commissions are recorded. Never trust a client-side redirect for this.
5. Sellers withdraw earnings via `request-withdrawal`; withdrawals are
   fulfilled manually off-platform (Ashtech's Direct API is inbound-only).

There is intentionally no wallet top-up / deposit flow for buyers —
every payment is tied to a specific order.
