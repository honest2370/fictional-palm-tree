-- ============================================================
-- SELLIZI — FULL SCHEMA REBUILD
-- Run top to bottom in one query in the Supabase SQL editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. USERS  (buyers, sellers, admins)
-- ============================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  phone text,
  role text not null check (role in ('buyer','seller','admin')),
  balance numeric not null default 0,
  currency text not null default 'XAF',
  country_code text,

  -- storefront
  store_name text,
  store_slug text unique,
  store_bio text,
  store_logo_url text,
  store_banner_url text,
  store_theme_color text default '#2563eb',
  is_store_public boolean not null default true,

  -- account state
  is_verified boolean not null default false,
  is_suspended boolean not null default false,

  -- push
  push_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_users_role on public.users(role);
create index idx_users_store_slug on public.users(store_slug);

-- ============================================================
-- 2. CATEGORIES  (site-wide product taxonomy)
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now()
);

create index idx_categories_slug on public.categories(slug);
create index idx_categories_parent on public.categories(parent_id);

-- ============================================================
-- 3. TAGS + PRODUCT_TAGS (many-to-many)
-- ============================================================
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. PRODUCTS
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  seller_name text,

  title text not null,
  slug text not null unique,
  short_desc text,
  description text,

  price numeric not null,
  compare_at_price numeric,
  discount_percent numeric,
  discount_until timestamptz,
  currency text not null default 'XAF',

  cover_url text,
  gallery_urls text[] default '{}',
  file_url text,
  delivery_link text,

  type text not null check (type in ('digital','account','course','link','service')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','archived')),

  category_id uuid references public.categories(id) on delete set null,

  total_slots integer default 0,
  available_slots integer default 0,
  account_platform text,
  cred1_label text,
  cred2_label text,
  slot_instructions text,

  curriculum jsonb,

  affiliate_enabled boolean not null default false,
  affiliate_commission numeric default 0,

  -- commerce
  allow_reviews boolean not null default true,
  is_featured boolean not null default false,

  -- analytics counters (denormalized for speed; kept in sync by triggers)
  view_count integer not null default 0,
  purchase_count integer not null default 0,
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  wishlist_count integer not null default 0,

  -- SEO
  seo_title text,
  seo_description text,
  seo_keywords text[],
  og_image_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_seller on public.products(seller_id);
create index idx_products_status on public.products(status);
create index idx_products_category on public.products(category_id);
create index idx_products_slug on public.products(slug);
create index idx_products_featured on public.products(is_featured) where is_featured = true;

create table public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (product_id, tag_id)
);

-- ============================================================
-- 5. ACCOUNT SLOTS (order_id FK completed after orders exists)
-- ============================================================
create table public.account_slots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  seller_id uuid not null references public.users(id) on delete cascade,
  platform text,
  cred1_label text,
  cred2_label text,
  cred1_value text not null,
  cred2_value text,
  status text not null default 'available' check (status in ('available','assigned')),
  order_id uuid,
  created_at timestamptz not null default now()
);

create index idx_slots_product_status on public.account_slots(product_id, status);

-- ============================================================
-- 6. CARTS + CART_ITEMS (multi-item checkout)
-- ============================================================
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.users(id) on delete cascade,
  session_token text, -- for guest carts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_owner check (buyer_id is not null or session_token is not null)
);

create unique index idx_carts_buyer on public.carts(buyer_id) where buyer_id is not null;
create unique index idx_carts_session on public.carts(session_token) where session_token is not null;

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  added_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

-- ============================================================
-- 7. DISCOUNT CODES / COUPONS
-- ============================================================
create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.users(id) on delete cascade,
  code text not null unique,
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  product_id uuid references public.products(id) on delete cascade,
  max_uses integer not null default 1,
  used_count integer not null default 0,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_discount_codes_code on public.discount_codes(code);

-- ============================================================
-- 8. ORDERS  (supports multi-item cart checkout via order_items)
-- ============================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,

  buyer_id uuid references public.users(id),
  buyer_name text,
  buyer_email text,
  buyer_phone text,

  subtotal numeric not null default 0,
  discount_code text,
  discount_amount numeric not null default 0,
  final_price numeric not null,
  currency text not null default 'XAF',

  payment_method text not null default 'ashtech' check (payment_method in ('ashtech','wallet')),
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','confirmed','failed','amount_mismatch','pending_review','refunded')),

  ashtech_transaction_id text,
  ashtech_operator text,
  ashtech_country_code text,
  ashtech_phone text,

  source text default 'checkout',
  affiliate_code text,

  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index idx_orders_buyer on public.orders(buyer_id);
create index idx_orders_ref on public.orders(order_ref);
create index idx_orders_status on public.orders(status);

-- one row per product in the order (replaces old single-product order shape)
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_title text,
  product_cover text,
  unit_price numeric not null,
  quantity integer not null default 1,
  seller_id uuid not null references public.users(id),
  seller_name text,
  seller_credit numeric not null default 0,
  delivery_link text,
  account_slot_id uuid references public.account_slots(id),
  created_at timestamptz not null default now()
);

create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_seller on public.order_items(seller_id);
create index idx_order_items_product on public.order_items(product_id);

alter table public.account_slots
  add constraint account_slots_order_item_fkey
  foreign key (order_id) references public.order_items(id) on delete set null;

-- ============================================================
-- 9. PRODUCT SESSIONS (guest checkout gating, unlock after payment)
-- ============================================================
create table public.product_sessions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  email text not null,
  access_granted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, email)
);

-- ============================================================
-- 10. WALLET TRANSACTIONS  (seller earnings/withdrawals ledger only —
--     no buyer deposits; buyers pay per-order via Ashtech Direct API)
-- ============================================================
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('credit','withdrawal','adjustment','refund_debit')),
  amount numeric not null,
  balance_after numeric not null,
  description text,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_wallet_tx_user on public.wallet_transactions(user_id, created_at desc);

-- ============================================================
-- 11. WITHDRAWALS  (seller payout requests)
-- ============================================================
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_name text,
  amount numeric not null,
  currency text not null default 'XAF',
  method text not null check (method in ('mtn','orange','paypal','bitcoin')),
  status text not null default 'pending' check (status in ('pending','completed','rejected')),
  account_number text,
  account_name text,
  paypal_email text,
  btc_wallet text,
  phone text,
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_withdrawals_user on public.withdrawals(user_id);
create index idx_withdrawals_status on public.withdrawals(status);

-- ============================================================
-- 12. REVIEWS  (with review schema support for SEO rich results)
-- ============================================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_id uuid references public.users(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  buyer_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  seller_reply text,
  seller_replied_at timestamptz,
  is_verified_purchase boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, order_id)
);

create index idx_reviews_product on public.reviews(product_id) where is_hidden = false;

-- ============================================================
-- 13. WISHLISTS
-- ============================================================
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, product_id)
);

create index idx_wishlists_buyer on public.wishlists(buyer_id);

-- ============================================================
-- 14. AFFILIATES  (per-seller affiliate program participants)
-- ============================================================
create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  affiliate_code text not null unique,
  clicks integer not null default 0,
  conversions integer not null default 0,
  total_earned numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index idx_affiliates_code on public.affiliates(affiliate_code);

create table public.affiliate_earnings (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  commission_amount numeric not null,
  status text not null default 'pending' check (status in ('pending','paid','void')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 15. PRODUCT ANALYTICS EVENTS (views, clicks — lightweight)
-- ============================================================
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  event_type text not null check (event_type in ('view','click','add_to_cart','wishlist','purchase','affiliate_click')),
  visitor_id text,
  referrer text,
  country_code text,
  created_at timestamptz not null default now()
);

create index idx_product_events_product on public.product_events(product_id, created_at desc);
create index idx_product_events_type on public.product_events(event_type);

-- ============================================================
-- 16. NOTIFICATIONS
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null default 'order',
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, read);

-- ============================================================
-- 17. PUSH SUBSCRIPTIONS  (Web Push / VAPID)
-- ============================================================
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index idx_push_subs_user on public.push_subscriptions(user_id);

-- ============================================================
-- 18. BLOG POSTS  (content marketing / SEO)
-- ============================================================
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.users(id) on delete set null,
  title text not null,
  slug text not null unique,
  excerpt text,
  content_md text not null,
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_blog_posts_slug on public.blog_posts(slug);
create index idx_blog_posts_status on public.blog_posts(status, published_at desc);

-- ============================================================
-- 19. SEO REDIRECTS  (301s for renamed slugs — protects rankings)
-- ============================================================
create table public.seo_redirects (
  id uuid primary key default gen_random_uuid(),
  from_path text not null unique,
  to_path text not null,
  status_code integer not null default 301,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 20. SITE SETTINGS  (global SEO defaults, robots directives, verification tags)
-- ============================================================
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value) values
  ('seo_defaults', jsonb_build_object(
    'site_name', 'Sellizi',
    'default_title', 'Sellizi — Buy & Sell Digital Products in Africa',
    'default_description', 'Sellizi is a digital marketplace for courses, accounts, digital downloads and services across Africa. Pay with Mobile Money.',
    'default_og_image', '/og-default.png',
    'twitter_handle', '@sellizi',
    'google_site_verification', ''
  )),
  ('robots', jsonb_build_object(
    'index', true,
    'follow', true,
    'disallow_paths', jsonb_build_array('/buyer/checkout', '/buyer/account', '/seller')
  ));

-- ============================================================
-- 21. AUDIT LOG  (admin actions — approvals, payouts, suspensions)
-- ============================================================
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_log_entity on public.audit_log(entity_type, entity_id);
