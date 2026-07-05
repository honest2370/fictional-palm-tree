import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input, Textarea, showToast } from "@/components/ui";

const THEME_COLORS = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#d97706", "#0891b2"];

export default function SellerStorefrontSettings() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState(user?.store_name || "");
  const [bio, setBio] = useState(user?.store_bio || "");
  const [logoUrl, setLogoUrl] = useState(user?.store_logo_url || "");
  const [bannerUrl, setBannerUrl] = useState(user?.store_banner_url || "");
  const [themeColor, setThemeColor] = useState(user?.store_theme_color || THEME_COLORS[0]);
  const [isPublic, setIsPublic] = useState(user?.is_store_public ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await sb.from("users").update({
      store_name: storeName, store_bio: bio, store_logo_url: logoUrl || null,
      store_banner_url: bannerUrl || null, store_theme_color: themeColor, is_store_public: isPublic,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    await refreshUser();
    showToast("Storefront updated", "success");
    navigate("/seller/account");
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-extrabold text-white mb-4">Storefront Settings</h1>

      <Input label="Store name" value={storeName} onChange={setStoreName} placeholder="Your store name" />
      <Textarea label="Bio" value={bio} onChange={setBio} placeholder="Tell buyers about your store…" rows={3} />
      <Input label="Logo image URL" value={logoUrl} onChange={setLogoUrl} placeholder="https://…" />
      <Input label="Banner image URL" value={bannerUrl} onChange={setBannerUrl} placeholder="https://…" />

      <div className="mb-4">
        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Theme color</label>
        <div className="flex gap-2">
          {THEME_COLORS.map((c) => (
            <button
              key={c} onClick={() => setThemeColor(c)}
              className={`w-9 h-9 rounded-full border-2 ${themeColor === c ? "border-white" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 mb-6 text-sm text-slate-300">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Make my storefront publicly visible and indexable by search engines
      </label>

      <Button fullWidth disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}
