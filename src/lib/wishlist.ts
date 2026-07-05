import { sb } from "./supabase";

export async function toggleWishlist(buyerId: string, productId: string): Promise<boolean> {
  const { data: existing } = await sb.from("wishlists").select("id").eq("buyer_id", buyerId).eq("product_id", productId).maybeSingle();
  if (existing) {
    await sb.from("wishlists").delete().eq("id", existing.id);
    return false;
  }
  await sb.from("wishlists").insert({ buyer_id: buyerId, product_id: productId });
  return true;
}

export async function isWishlisted(buyerId: string, productId: string): Promise<boolean> {
  const { data } = await sb.from("wishlists").select("id").eq("buyer_id", buyerId).eq("product_id", productId).maybeSingle();
  return !!data;
}

export async function loadWishlist(buyerId: string) {
  const { data } = await sb.from("wishlists")
    .select("*, product:product_id(*)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  return data || [];
}
