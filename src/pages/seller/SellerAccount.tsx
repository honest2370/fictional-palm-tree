import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, showToast } from "@/components/ui";
import { Store, Users, Bell, BellOff, ExternalLink } from "lucide-react";
import { usePushNotifications } from "@/lib/push";

export default function SellerAccount() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  async function togglePush() {
    try {
      if (subscribed) { await unsubscribe(); showToast("Notifications turned off", "success"); }
      else { await subscribe(); showToast("Notifications turned on", "success"); }
    } catch (e: any) {
      showToast(e?.message || "Couldn't update notification settings", "error");
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">My Account</h1>
      <Card className="bg-slate-800 border-slate-700 mb-4">
        <p className="font-bold text-white">{user?.name}</p>
        <p className="text-sm text-slate-400">{user?.email}</p>
        <p className="text-sm text-slate-400">{user?.store_name}</p>
      </Card>

      {user?.store_slug && (
        <a
          href={`/store/${user.store_slug}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-3 text-sm text-blue-400 font-medium"
        >
          View public storefront <ExternalLink size={15} />
        </a>
      )}

      <button onClick={() => navigate("/seller/storefront")} className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-3 text-left">
        <Store size={18} className="text-blue-400" />
        <div>
          <p className="text-sm font-semibold text-white">Storefront settings</p>
          <p className="text-xs text-slate-400">Logo, banner, bio, theme color</p>
        </div>
      </button>

      <button onClick={() => navigate("/seller/affiliates")} className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-2xl p-4 mb-3 text-left">
        <Users size={18} className="text-blue-400" />
        <div>
          <p className="text-sm font-semibold text-white">Affiliate program</p>
          <p className="text-xs text-slate-400">Manage commissions and payouts</p>
        </div>
      </button>

      {supported && (
        <Card className="bg-slate-800 border-slate-700 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {subscribed ? <Bell size={18} className="text-emerald-400" /> : <BellOff size={18} className="text-slate-500" />}
            <div>
              <p className="text-sm font-semibold text-white">Push notifications</p>
              <p className="text-xs text-slate-400">New orders, payouts</p>
            </div>
          </div>
          <Button size="sm" variant={subscribed ? "secondary" : "primary"} disabled={loading} onClick={togglePush}>
            {loading ? "…" : subscribed ? "On" : "Enable"}
          </Button>
        </Card>
      )}

      <Button fullWidth variant="secondary" onClick={async () => { await signOut(); navigate("/seller/login"); }}>Sign Out</Button>
    </div>
  );
}
