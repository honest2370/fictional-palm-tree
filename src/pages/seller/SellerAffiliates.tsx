import React, { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Badge, Spinner, Button, showToast } from "@/components/ui";
import type { Product } from "@/types";

export default function SellerAffiliates() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function refresh() {
    if (!user) return;
    const { data } = await sb.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [user?.id]);

  async function toggleAffiliate(product: Product) {
    setSaving(product.id);
    const enabling = !product.affiliate_enabled;
    const { error } = await sb.from("products").update({
      affiliate_enabled: enabling,
      affiliate_commission: enabling ? (product.affiliate_commission || 10) : product.affiliate_commission,
    }).eq("id", product.id);
    setSaving(null);
    if (error) { showToast(error.message, "error"); return; }
    refresh();
  }

  async function updateCommission(product: Product, value: number) {
    await sb.from("products").update({ affiliate_commission: value }).eq("id", product.id);
    refresh();
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-400" /></div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-extrabold text-white mb-1">Affiliate Program</h1>
      <p className="text-sm text-slate-400 mb-4">Let others earn a commission promoting your products.</p>

      {products.length === 0 ? (
        <p className="text-center text-slate-500 py-20">No products yet.</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <Card key={p.id} className="bg-slate-800 border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-white text-sm">{p.title}</p>
                {p.affiliate_enabled ? <Badge color="green">Enabled</Badge> : <Badge color="slate">Disabled</Badge>}
              </div>
              {p.affiliate_enabled && (
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs text-slate-400">Commission %</label>
                  <input
                    type="number" min={1} max={90} defaultValue={p.affiliate_commission || 10}
                    onBlur={(e) => updateCommission(p, Number(e.target.value))}
                    className="w-20 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
                  />
                </div>
              )}
              <Button size="sm" variant={p.affiliate_enabled ? "danger" : "primary"} disabled={saving === p.id} onClick={() => toggleAffiliate(p)}>
                {saving === p.id ? "…" : p.affiliate_enabled ? "Disable affiliate" : "Enable affiliate"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
