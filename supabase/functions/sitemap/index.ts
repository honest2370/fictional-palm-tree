// supabase/functions/sitemap/index.ts
// Generates sitemap.xml dynamically from approved products, public
// storefronts, categories and published blog posts. Point your
// static /sitemap.xml (or a Vercel rewrite) at this function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL") || "https://sellizi.app";

function urlEntry(loc: string, lastmod?: string, priority = "0.7") {
  return `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ""}    <priority>${priority}</priority>\n  </url>`;
}

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: products }, { data: sellers }, { data: categories }, { data: posts }] = await Promise.all([
    admin.from("products").select("slug,updated_at").eq("status", "approved"),
    admin.from("users").select("store_slug,updated_at").eq("role", "seller").eq("is_store_public", true).not("store_slug", "is", null),
    admin.from("categories").select("slug").eq("is_active", true),
    admin.from("blog_posts").select("slug,updated_at").eq("status", "published"),
  ]);

  const entries: string[] = [
    urlEntry(`${SITE_URL}/`, undefined, "1.0"),
    urlEntry(`${SITE_URL}/products`, undefined, "0.9"),
    urlEntry(`${SITE_URL}/blog`, undefined, "0.6"),
  ];

  for (const p of products || []) entries.push(urlEntry(`${SITE_URL}/product/${p.slug}`, p.updated_at, "0.8"));
  for (const s of sellers || []) entries.push(urlEntry(`${SITE_URL}/store/${s.store_slug}`, s.updated_at, "0.7"));
  for (const c of categories || []) entries.push(urlEntry(`${SITE_URL}/category/${c.slug}`, undefined, "0.6"));
  for (const b of posts || []) entries.push(urlEntry(`${SITE_URL}/blog/${b.slug}`, b.updated_at, "0.5"));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=1800" },
  });
});
