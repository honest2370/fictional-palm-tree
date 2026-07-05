import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, showToast } from "@/components/ui";
import { Heart, ShoppingBag, GraduationCap, Bell, BellOff } from "lucide-react";
import { usePushNotifications } from "@/lib/push";

export default function BuyerAccount() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  async function togglePush() {
    try {
      if (subscribed) {
        await unsubscribe();
        showToast("Notifications turned off", "success");
      } else {
        await subscribe();
        showToast("Notifications turned on", "success");
      }
    } catch (e: any) {
      showToast(e?.message || "Couldn't update notification settings", "error");
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">My Account</h1>
      <Card className="mb-4">
        <p className="font-bold text-slate-900">{user?.name}</p>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </Card>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <button onClick={() => navigate("/buyer/orders")} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white py-3">
          <ShoppingBag size={20} className="text-blue-600" />
          <span className="text-xs font-medium text-slate-700">Orders</span>
        </button>
        <button onClick={() => navigate("/buyer/courses")} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white py-3">
          <GraduationCap size={20} className="text-blue-600" />
          <span className="text-xs font-medium text-slate-700">Courses</span>
        </button>
        <button onClick={() => navigate("/buyer/wishlist")} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white py-3">
          <Heart size={20} className="text-blue-600" />
          <span className="text-xs font-medium text-slate-700">Wishlist</span>
        </button>
      </div>

      {supported && (
        <Card className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {subscribed ? <Bell size={18} className="text-emerald-600" /> : <BellOff size={18} className="text-slate-400" />}
            <div>
              <p className="text-sm font-semibold text-slate-900">Push notifications</p>
              <p className="text-xs text-slate-500">Order updates, delivery alerts</p>
            </div>
          </div>
          <Button size="sm" variant={subscribed ? "secondary" : "primary"} disabled={loading} onClick={togglePush}>
            {loading ? "…" : subscribed ? "On" : "Enable"}
          </Button>
        </Card>
      )}

      <Button fullWidth variant="secondary" onClick={async () => { await signOut(); navigate("/buyer/login"); }}>Sign Out</Button>
    </div>
  );
}
