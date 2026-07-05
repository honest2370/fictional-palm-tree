import React, { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Badge, Spinner } from "@/components/ui";
import type { OrderItem, Order } from "@/types";

export default function SellerOrders() {
  const { user } = useAuth();
  const [rows, setRows] = useState<(OrderItem & { order: Order })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    sb.from("order_items")
      .select("*, order:order_id(order_ref,status,buyer_name,buyer_email,created_at,currency)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows((data as any[]) || []); setLoading(false); });
  }, [user?.id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-400" /></div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">Sales</h1>
      {rows.length === 0 ? (
        <p className="text-center text-slate-500 py-20">No sales yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((item) => (
            <Card key={item.id} className="bg-slate-800 border-slate-700">
              <div className="flex justify-between items-start mb-1">
                <p className="font-bold text-white">{item.product_title}</p>
                <Badge color={item.order.status === "confirmed" ? "green" : item.order.status === "failed" ? "red" : "amber"}>
                  {item.order.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-sm text-slate-400">{item.order.buyer_name || item.order.buyer_email} · qty {item.quantity}</p>
              {item.order.status === "confirmed" && (
                <p className="text-sm text-emerald-400 font-semibold mt-1">+{item.seller_credit.toLocaleString()} {item.order.currency}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
