-- ============================================================
-- TRIGGERS — keep denormalized counters and timestamps in sync
-- ============================================================

-- ---------- updated_at auto-touch ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_touch before update on public.users
  for each row execute function public.touch_updated_at();
create trigger trg_products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger trg_carts_touch before update on public.carts
  for each row execute function public.touch_updated_at();
create trigger trg_blog_touch before update on public.blog_posts
  for each row execute function public.touch_updated_at();

-- ---------- review rating rollup ----------
create or replace function public.recalc_product_rating()
returns trigger language plpgsql as $$
declare
  p_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating_avg = coalesce((
        select round(avg(r.rating)::numeric, 2)
        from public.reviews r
        where r.product_id = p_id and r.is_hidden = false
      ), 0),
      rating_count = coalesce((
        select count(*) from public.reviews r
        where r.product_id = p_id and r.is_hidden = false
      ), 0)
  where p.id = p_id;
  return null;
end;
$$;

create trigger trg_reviews_rating_ins after insert on public.reviews
  for each row execute function public.recalc_product_rating();
create trigger trg_reviews_rating_upd after update on public.reviews
  for each row execute function public.recalc_product_rating();
create trigger trg_reviews_rating_del after delete on public.reviews
  for each row execute function public.recalc_product_rating();

-- ---------- wishlist counter ----------
create or replace function public.recalc_wishlist_count()
returns trigger language plpgsql as $$
declare
  p_id uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set wishlist_count = (select count(*) from public.wishlists w where w.product_id = p_id)
  where p.id = p_id;
  return null;
end;
$$;

create trigger trg_wishlist_ins after insert on public.wishlists
  for each row execute function public.recalc_wishlist_count();
create trigger trg_wishlist_del after delete on public.wishlists
  for each row execute function public.recalc_wishlist_count();

-- ---------- product view/click counters from product_events ----------
create or replace function public.bump_product_counters()
returns trigger language plpgsql as $$
begin
  if new.event_type = 'view' then
    update public.products set view_count = view_count + 1 where id = new.product_id;
  elsif new.event_type = 'purchase' then
    update public.products set purchase_count = purchase_count + 1 where id = new.product_id;
  end if;
  return new;
end;
$$;

create trigger trg_product_events_bump after insert on public.product_events
  for each row execute function public.bump_product_counters();

-- ---------- cart updated_at bump on item change ----------
create or replace function public.touch_cart()
returns trigger language plpgsql as $$
begin
  update public.carts set updated_at = now() where id = coalesce(new.cart_id, old.cart_id);
  return null;
end;
$$;

create trigger trg_cart_items_touch after insert or update or delete on public.cart_items
  for each row execute function public.touch_cart();
