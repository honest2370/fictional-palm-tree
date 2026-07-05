import React, { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Badge, Spinner } from "@/components/ui";
import { Seo } from "@/components/Seo";
import ReviewModal from "@/components/ReviewModal";
import type { Order, OrderItem } from "@/types";

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<(Order & { items: OrderItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<{ orderId: string; item: OrderItem } | null>(null);

  async function refresh() {
    if (!user) return;
    const { data: orderRows } = await sb.from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false });
    const orderIds = (orderRows || []).map((o: any) => o.id);
    const { data: itemRows } = orderIds.length
      ? await sb.from("order_items").select("*").in("order_id", orderIds)
      : { data: [] as any[] };
    const merged = (orderRows || []).map((o: any) => ({ ...o, items: (itemRows || []).filter((i: any) => i.order_id === o.id) }));
    setOrders(merged);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [user?.id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;

  return (
    <div className="p-4">
      <Seo title="My Orders" description="View your past purchases and access your digital products." path="/buyer/orders" noindex />
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">My Orders</h1>
      {orders.length === 0 ? (
        <p className="text-center text-slate-400 py-20">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id}>
              <div className="flex justify-between items-start mb-2">
                <p className="text-xs text-slate-400">{o.order_ref}</p>
                <Badge color={o.status === "confirmed" ? "green" : o.status === "failed" ? "red" : "amber"}>{o.status.replace("_", " ")}</Badge>
              </div>
              <div className="space-y-2 mb-2">
                {o.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{item.product_title}</p>
                      <p className="text-xs text-slate-500">{item.unit_price.toLocaleString()} {o.currency} × {item.quantity}</p>
                    </div>
                    {o.status === "confirmed" && (
                      <div className="flex items-center gap-2">
                        {item.delivery_link && (
                          <a href={item.delivery_link} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-semibold">Access ↓</a>
                        )}
                        <button onClick={() => setReviewTarget({ orderId: o.id, item })} className="text-xs font-semibold text-amber-600">Review</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm font-bold text-slate-900 border-t border-slate-100 pt-2">{o.final_price.toLocaleString()} {o.currency}</p>
            </Card>
          ))}
        </div>
      )}

      {reviewTarget && (
        <ReviewModal
          productId={reviewTarget.item.product_id}
          orderId={reviewTarget.orderId}
          buyerName={user?.name || "Buyer"}
          buyerId={user?.id || null}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => setReviewTarget(null)}
        />
      )}
    </div>
  );
}
