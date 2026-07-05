import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Spinner } from "@/components/ui";
import { Seo } from "@/components/Seo";
import { loadWishlist, toggleWishlist } from "@/lib/wishlist";
import { Heart } from "lucide-react";
import type { Product } from "@/types";

export default function Wishlist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<{ id: string; product: Product }[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!user) return;
    setItems((await loadWishlist(user.id)) as any);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [user?.id]);

  async function remove(productId: string) {
    if (!user) return;
    await toggleWishlist(user.id, productId);
    refresh();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;

  return (
    <div className="p-4">
      <Seo title="Your Wishlist" description="Products you've saved for later on Sellizi." path="/buyer/wishlist" noindex />
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">Wishlist</h1>

      {items.length === 0 ? (
        <p className="text-center text-slate-400 py-20">Nothing saved yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ id, product }) => (
            <Card key={id} className="p-2.5 relative">
              <button onClick={() => remove(product.id)} className="absolute top-3 right-3 z-10 bg-white/90 rounded-full p-1.5">
                <Heart size={14} className="fill-red-500 text-red-500" />
              </button>
              <div onClick={() => navigate(`/buyer/product/${product.slug}`)} className="cursor-pointer">
                {product.cover_url ? (
                  <img src={product.cover_url} className="w-full h-28 object-cover rounded-xl mb-2" alt={product.title} />
                ) : (
                  <div className="w-full h-28 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-3xl">📦</div>
                )}
                <p className="font-semibold text-sm line-clamp-2 mb-1">{product.title}</p>
                <p className="text-blue-600 font-bold">{product.price.toLocaleString()} {product.currency}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
