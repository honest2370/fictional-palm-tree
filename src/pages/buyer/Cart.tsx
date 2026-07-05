import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, Spinner, showToast } from "@/components/ui";
import { Seo } from "@/components/Seo";
import { loadCart, updateCartItemQuantity, removeCartItem } from "@/lib/cart";
import { Trash2, Minus, Plus, ShoppingBag } from "lucide-react";
import type { CartItem, Product } from "@/types";

export default function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<(CartItem & { product: Product })[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!user) return;
    setItems(await loadCart(user.id));
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [user?.id]);

  async function changeQty(itemId: string, qty: number) {
    await updateCartItemQuantity(itemId, qty);
    refresh();
  }

  async function remove(itemId: string) {
    await removeCartItem(itemId);
    showToast("Removed from cart", "success");
    refresh();
  }

  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const currency = items[0]?.product.currency || "XAF";

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;

  return (
    <div className="p-4 pb-32">
      <Seo title="Your Cart" description="Review the items in your Sellizi cart before checkout." path="/buyer/cart" noindex />
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">Your Cart</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400 mb-4">Your cart is empty.</p>
          <Button onClick={() => navigate("/buyer")}>Browse products</Button>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {items.map((item) => (
              <Card key={item.id} className="flex gap-3">
                {item.product.cover_url ? (
                  <img src={item.product.cover_url} className="w-16 h-16 object-cover rounded-lg shrink-0" alt={item.product.title} />
                ) : (
                  <div className="w-16 h-16 bg-slate-100 rounded-lg shrink-0 flex items-center justify-center text-xl">📦</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{item.product.title}</p>
                  <p className="text-blue-600 font-bold text-sm">{item.product.price.toLocaleString()} {item.product.currency}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button onClick={() => changeQty(item.id, item.quantity - 1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"><Minus size={12} /></button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button onClick={() => changeQty(item.id, item.quantity + 1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center"><Plus size={12} /></button>
                    <button onClick={() => remove(item.id)} className="ml-auto text-red-400"><Trash2 size={16} /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-slate-200 p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-lg font-extrabold text-slate-900">{total.toLocaleString()} {currency}</span>
            </div>
            <Button fullWidth onClick={() => navigate("/buyer/checkout")}>Checkout</Button>
          </div>
        </>
      )}
    </div>
  );
}
