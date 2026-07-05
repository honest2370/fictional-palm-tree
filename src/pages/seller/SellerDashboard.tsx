import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Spinner } from "@/components/ui";
import type { Product, OrderItem } from "@/types";

export default function SellerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [soldItems, setSoldItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      sb.from("products").select("*").eq("seller_id", user.id),
      sb.from("order_items").select("*, order:order_id!inner(status)").eq("seller_id", user.id).eq("order.status", "confirmed"),
    ]).then(([{ data: p }, { data: items }]) => {
      setProducts((p as Product[]) || []);
      setSoldItems((items as any[]) || []);
      setLoading(false);
    });
  }, [user?.id]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-400" /></div>;

  const totalSales = soldItems.reduce((sum, i) => sum + i.seller_credit, 0);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">Seller Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Total earnings</p>
          <p className="text-xl font-extrabold text-emerald-400">{totalSales.toLocaleString()} {user?.currency}</p>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Products</p>
          <p className="text-xl font-extrabold text-white">{products.length}</p>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Sales</p>
          <p className="text-xl font-extrabold text-white">{soldItems.length}</p>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Wallet balance</p>
          <p className="text-xl font-extrabold text-white">{user?.balance?.toLocaleString()} {user?.currency}</p>
        </Card>
      </div>
      <button onClick={() => navigate("/seller/products/new")} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold">
        + Add New Product
      </button>
    </div>
  );
}
