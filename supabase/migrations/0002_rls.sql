-- ============================================================
-- ROW LEVEL SECURITY
-- All money-mutating writes happen via edge functions using the
-- service role key, which bypasses RLS. These policies govern what
-- the browser (anon/authenticated client) may read or write directly.
-- ============================================================

alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.products enable row level security;
alter table public.product_tags enable row level security;
alter table public.account_slots enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.discount_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.product_sessions enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.withdrawals enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlists enable row level security;
alter table public.affiliates enable row level security;
alter table public.affiliate_earnings enable row level security;
alter table public.product_events enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.blog_posts enable row level security;
alter table public.seo_redirects enable row level security;
alter table public.site_settings enable row level security;
alter table public.audit_log enable row level security;

-- ---------- USERS ----------
create policy "users_select_own" on public.users for select using (auth.uid() = id);
create policy "users_select_public_store" on public.users for select using (is_store_public = true and role = 'seller');
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

-- ---------- CATEGORIES / TAGS (public read) ----------
create policy "categories_public_read" on public.categories for select using (is_active = true);
create policy "tags_public_read" on public.tags for select using (true);

-- ---------- PRODUCTS ----------
create policy "products_public_read_approved" on public.products
  for select using (status = 'approved' or seller_id = auth.uid());
create policy "products_seller_insert" on public.products
  for insert with check (seller_id = auth.uid());
create policy "products_seller_update" on public.products
  for update using (seller_id = auth.uid());
create policy "products_seller_delete" on public.products
  for delete using (seller_id = auth.uid());

create policy "product_tags_public_read" on public.product_tags for select using (true);
create policy "product_tags_seller_manage" on public.product_tags for all using (
  product_id in (select id from public.products where seller_id = auth.uid())
);

-- ---------- ACCOUNT SLOTS ----------
create policy "slots_seller_manage" on public.account_slots for all using (seller_id = auth.uid());
create policy "slots_buyer_view_assigned" on public.account_slots for select using (
  order_id in (
    select oi.id from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.buyer_id = auth.uid()
  )
);

-- ---------- CARTS ----------
create policy "carts_owner_all" on public.carts for all using (buyer_id = auth.uid());
create policy "cart_items_owner_all" on public.cart_items for all using (
  cart_id in (select id from public.carts where buyer_id = auth.uid())
);

-- ---------- DISCOUNT CODES ----------
create policy "discount_codes_public_read_active" on public.discount_codes for select using (is_active = true);
create policy "discount_codes_seller_manage" on public.discount_codes for all using (seller_id = auth.uid());

-- ---------- ORDERS ----------
create policy "orders_buyer_read" on public.orders for select using (buyer_id = auth.uid());
create policy "orders_buyer_insert" on public.orders for insert with check (buyer_id = auth.uid() or buyer_id is null);

create policy "order_items_buyer_read" on public.order_items for select using (
  order_id in (select id from public.orders where buyer_id = auth.uid())
);
create policy "order_items_seller_read" on public.order_items for select using (seller_id = auth.uid());

-- ---------- PRODUCT SESSIONS (service role only, never exposed to browser) ----------
create policy "product_sessions_service_only" on public.product_sessions for all using (auth.role() = 'service_role');

-- ---------- WALLET / WITHDRAWALS ----------
create policy "wallet_tx_owner_read" on public.wallet_transactions for select using (user_id = auth.uid());
create policy "withdrawals_owner_read" on public.withdrawals for select using (user_id = auth.uid());

-- ---------- REVIEWS ----------
create policy "reviews_public_read" on public.reviews for select using (is_hidden = false);
create policy "reviews_buyer_insert" on public.reviews for insert with check (buyer_id = auth.uid());
create policy "reviews_buyer_update_own" on public.reviews for update using (buyer_id = auth.uid());
create policy "reviews_seller_reply" on public.reviews for update using (
  product_id in (select id from public.products where seller_id = auth.uid())
);

-- ---------- WISHLISTS ----------
create policy "wishlists_owner_all" on public.wishlists for all using (buyer_id = auth.uid());

-- ---------- AFFILIATES ----------
create policy "affiliates_owner_read" on public.affiliates for select using (user_id = auth.uid());
create policy "affiliates_owner_insert" on public.affiliates for insert with check (user_id = auth.uid());
create policy "affiliate_earnings_owner_read" on public.affiliate_earnings for select using (
  affiliate_id in (select id from public.affiliates where user_id = auth.uid())
);

-- ---------- PRODUCT EVENTS (write-only from anon, read by product owner) ----------
create policy "product_events_insert_anyone" on public.product_events for insert with check (true);
create policy "product_events_seller_read" on public.product_events for select using (
  product_id in (select id from public.products where seller_id = auth.uid())
);

-- ---------- NOTIFICATIONS ----------
create policy "notifications_owner_read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications_owner_update" on public.notifications for update using (user_id = auth.uid());

-- ---------- PUSH SUBSCRIPTIONS ----------
create policy "push_subs_owner_all" on public.push_subscriptions for all using (user_id = auth.uid());

-- ---------- BLOG (public read published, author manages own) ----------
create policy "blog_public_read_published" on public.blog_posts for select using (status = 'published' or author_id = auth.uid());
create policy "blog_author_manage" on public.blog_posts for all using (author_id = auth.uid());

-- ---------- SEO / SETTINGS (public read, no direct write) ----------
create policy "seo_redirects_public_read" on public.seo_redirects for select using (true);
create policy "site_settings_public_read" on public.site_settings for select using (true);

-- ---------- AUDIT LOG (admins only) ----------
create policy "audit_log_admin_read" on public.audit_log for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
