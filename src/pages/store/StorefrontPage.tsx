import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { Card, Badge, Spinner } from "@/components/ui";
import { Seo, breadcrumbJsonLd } from "@/components/Seo";
import { Star } from "lucide-react";
import type { Product, AppUser } from "@/types";

export default function StorefrontPage() {
  const { storeSlug } = useParams();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<AppUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!storeSlug) return;
    async function load() {
      // Support lookup by store_slug (public URL) or raw user id (internal links from product pages).
      const bySlug = await sb.from("users").select("*").eq("store_slug", storeSlug).eq("is_store_public", true).maybeSingle();
      const seller = bySlug.data || (await sb.from("users").select("*").eq("id", storeSlug).eq("is_store_public", true).maybeSingle()).data;
      if (!seller) { setNotFound(true); setLoading(false); return; }
      setSeller(seller as AppUser);
      const { data: p } = await sb.from("products").select("*").eq("seller_id", seller.id).eq("status", "approved").order("created_at", { ascending: false });
      setProducts((p as Product[]) || []);
      setLoading(false);
    }
    load();
  }, [storeSlug]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;
  if (notFound || !seller) return <p className="text-center text-slate-400 py-20">Store not found.</p>;

  return (
    <div className="pb-8">
      <Seo
        title={`${seller.store_name || seller.name} — Store`}
        description={seller.store_bio || `Browse digital products from ${seller.store_name || seller.name} on Sellizi.`}
        path={`/store/${seller.store_slug || seller.id}`}
        image={seller.store_banner_url}
        type="profile"
        jsonLd={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: seller.store_name || "Store", path: `/store/${seller.store_slug}` }])}
      />

      {seller.store_banner_url ? (
        <img src={seller.store_banner_url} className="w-full h-32 object-cover" alt="" />
      ) : (
        <div className="w-full h-32" style={{ backgroundColor: seller.store_theme_color || "#2563eb" }} />
      )}

      <div className="px-4 -mt-8 flex items-end gap-3 mb-4">
        {seller.store_logo_url ? (
          <img src={seller.store_logo_url} className="w-16 h-16 rounded-2xl border-4 border-white object-cover" alt="" />
        ) : (
          <div className="w-16 h-16 rounded-2xl border-4 border-white bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500">
            {(seller.store_name || seller.name || "S")[0]}
          </div>
        )}
      </div>

      <div className="px-4">
        <h1 className="text-xl font-extrabold text-slate-900">{seller.store_name || seller.name}</h1>
        {seller.store_bio && <p className="text-sm text-slate-500 mt-1 mb-4">{seller.store_bio}</p>}

        <p className="text-xs font-semibold text-slate-500 uppercase mb-2 mt-4">{products.length} Products</p>
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <Card key={p.id} className="cursor-pointer p-2.5" >
              <div onClick={() => navigate(`/buyer/product/${p.slug}`)}>
                {p.cover_url ? (
                  <img src={p.cover_url} className="w-full h-28 object-cover rounded-xl mb-2" alt={p.title} />
                ) : (
                  <div className="w-full h-28 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-3xl">📦</div>
                )}
                <p className="font-semibold text-sm line-clamp-2 mb-1">{p.title}</p>
                {p.rating_count > 0 && (
                  <div className="flex items-center gap-1 mb-1">
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <span className="text-xs text-slate-500">{p.rating_avg.toFixed(1)}</span>
                  </div>
                )}
                <p className="text-blue-600 font-bold">{p.price.toLocaleString()} {p.currency}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
