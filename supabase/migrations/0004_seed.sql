-- ============================================================
-- SEED DATA — starter categories so the storefront isn't empty
-- on day one. Safe to edit/delete afterward from the dashboard.
-- ============================================================
insert into public.categories (name, slug, icon, sort_order) values
  ('Digital Downloads', 'digital-downloads', '📦', 1),
  ('Online Courses', 'courses', '🎓', 2),
  ('Accounts & Subscriptions', 'accounts', '🔑', 3),
  ('Services', 'services', '🛠️', 4),
  ('E-books', 'ebooks', '📚', 5),
  ('Design & Templates', 'design-templates', '🎨', 6),
  ('Software & Tools', 'software-tools', '💻', 7)
on conflict (slug) do nothing;
