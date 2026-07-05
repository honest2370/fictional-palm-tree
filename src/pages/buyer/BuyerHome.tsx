import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { Card, Badge, Spinner } from "@/components/ui";
import { Seo } from "@/components/Seo";
import { Star, Search } from "lucide-react";
import type { Product, Category } from "@/types";

export default function BuyerHome() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      sb.from("products").select("*").eq("status", "approved").order("created_at", { ascending: false }),
      sb.from("categories").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    ]).then(([{ data: p }, { data: c }]) => {
      setProducts((p as Product[]) || []);
      setCategories((c as Category[]) || []);
      setLoading(false);
    });
  }, []);

  const filtered = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !activeCategory || p.category_id === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4">
      <Seo
        title="Browse Digital Products, Courses & Accounts"
        description="Discover digital downloads, online courses, verified accounts and services from sellers across Africa. Pay securely with Mobile Money."
        path="/buyer"
      />
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">Browse Products</h1>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…"
          className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-3 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4 no-scrollbar">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${!activeCategory ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${activeCategory === c.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-20">No products found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="cursor-pointer p-2.5">
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
                    <span className="text-xs text-slate-500">{p.rating_avg.toFixed(1)} ({p.rating_count})</span>
                  </div>
                )}
                <p className="text-blue-600 font-bold">{p.price.toLocaleString()} {p.currency}</p>
                <div className="flex gap-1 mt-1">
                  {p.type === "course" && <Badge color="green">Course</Badge>}
                  {p.type === "account" && <Badge color="amber">{(p.available_slots ?? 0) > 0 ? `${p.available_slots} left` : "Out of stock"}</Badge>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
