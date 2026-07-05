import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Badge, Spinner, showToast, StarRating } from "@/components/ui";
import { addToCart } from "@/lib/cart";
import { toggleWishlist, isWishlisted } from "@/lib/wishlist";
import { Seo, productJsonLd, breadcrumbJsonLd } from "@/components/Seo";
import { Heart, ShoppingCart, Store } from "lucide-react";
import type { Product, Review } from "@/types";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [sellerStoreSlug, setSellerStoreSlug] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    if (!slug) return;
    sb.from("products").select("*").eq("slug", slug).maybeSingle().then(async ({ data }) => {
      const p = data as Product | null;
      setProduct(p);
      setLoading(false);
      if (p) {
        sb.from("product_events").insert({ product_id: p.id, event_type: "view" }).then(() => {});
        sb.from("reviews").select("*").eq("product_id", p.id).eq("is_hidden", false)
          .order("created_at", { ascending: false }).then(({ data: r }) => setReviews((r as Review[]) || []));
        sb.from("users").select("store_slug").eq("id", p.seller_id).maybeSingle()
          .then(({ data: s }) => setSellerStoreSlug(s?.store_slug || null));
        if (user) isWishlisted(user.id, p.id).then(setWishlisted);
      }
    });
  }, [slug, user?.id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;
  if (!product) return <p className="text-center text-slate-400 py-20">Product not found.</p>;

  const outOfStock = product.type === "account" && (product.available_slots ?? 0) <= 0;
  const effectivePrice = product.discount_percent && product.discount_until && new Date(product.discount_until) > new Date()
    ? Math.round(product.price * (1 - product.discount_percent / 100))
    : product.price;

  async function handleWishlist() {
    if (!user) { navigate("/buyer/login"); return; }
    const newState = await toggleWishlist(user.id, product!.id);
    setWishlisted(newState);
  }

  async function handleAddToCart() {
    if (!user) { navigate("/buyer/login"); return; }
    setAddingToCart(true);
    try {
      await addToCart(user.id, product!.id);
      showToast("Added to cart", "success");
    } catch (e: any) {
      showToast(e?.message || "Could not add to cart", "error");
    } finally {
      setAddingToCart(false);
    }
  }

  return (
    <div className="p-4 pb-28">
      <Seo
        title={product.seo_title || product.title}
        description={product.seo_description || product.short_desc || product.description?.slice(0, 155) || product.title}
        path={`/product/${product.slug}`}
        image={product.og_image_url || product.cover_url}
        type="product"
        jsonLd={[
          productJsonLd(product),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Products", path: "/products" },
            { name: product.title, path: `/product/${product.slug}` },
          ]),
        ]}
      />

      {product.cover_url && <img src={product.cover_url} className="w-full h-48 object-cover rounded-2xl mb-4" alt={product.title} />}

      <div className="flex items-start justify-between gap-2 mb-1">
        <h1 className="text-xl font-extrabold text-slate-900 flex-1">{product.title}</h1>
        <button onClick={handleWishlist} aria-label="Toggle wishlist" className="shrink-0 p-2 rounded-full bg-slate-100">
          <Heart size={18} className={wishlisted ? "fill-red-500 text-red-500" : "text-slate-400"} />
        </button>
      </div>

      <button onClick={() => navigate(`/store/${sellerStoreSlug || product.seller_id}`)} className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
        <Store size={13} /> {product.seller_name}
      </button>

      <div className="flex items-center gap-2 mb-3">
        {product.type === "course" && <Badge color="green">Course</Badge>}
        {product.type === "account" && <Badge color={outOfStock ? "red" : "amber"}>{outOfStock ? "Out of stock" : `${product.available_slots} available`}</Badge>}
        {product.rating_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <StarRating value={Math.round(product.rating_avg)} readOnly size={13} /> ({product.rating_count})
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <p className="text-2xl font-extrabold text-blue-600">{effectivePrice.toLocaleString()} {product.currency}</p>
        {effectivePrice !== product.price && <p className="text-sm text-slate-400 line-through">{product.price.toLocaleString()}</p>}
      </div>

      <p className="text-sm text-slate-600 whitespace-pre-wrap mb-6">{product.description}</p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Button variant="secondary" disabled={outOfStock || addingToCart} onClick={handleAddToCart}>
          <span className="flex items-center justify-center gap-1.5"><ShoppingCart size={16} /> {addingToCart ? "Adding…" : "Add to cart"}</span>
        </Button>
        <Button disabled={outOfStock} onClick={() => navigate(`/buyer/checkout/${product.slug}`)}>
          Buy now
        </Button>
      </div>

      <ReviewsSection productId={product.id} allowReviews={product.allow_reviews} reviews={reviews} />
    </div>
  );
}

function ReviewsSection({ productId, allowReviews, reviews }: { productId: string; allowReviews: boolean; reviews: Review[] }) {
  if (!allowReviews) return null;
  return (
    <div className="mt-8">
      <h2 className="text-base font-bold text-slate-900 mb-3">Reviews ({reviews.length})</h2>
      {reviews.length === 0 ? (
        <p className="text-sm text-slate-400">No reviews yet.</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-slate-800">{r.buyer_name}</p>
                <StarRating value={r.rating} readOnly size={14} />
              </div>
              {r.title && <p className="text-sm font-medium text-slate-700">{r.title}</p>}
              {r.body && <p className="text-sm text-slate-600 mt-0.5">{r.body}</p>}
              {r.seller_reply && (
                <div className="mt-2 bg-slate-50 rounded-lg p-2.5">
                  <p className="text-xs font-semibold text-slate-500 mb-0.5">Seller reply</p>
                  <p className="text-xs text-slate-600">{r.seller_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
