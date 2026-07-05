import { sb } from "./supabase";
import type { CartItem, Product } from "@/types";

/** Ensures the current buyer has a cart row, returns its id. */
async function ensureCart(buyerId: string): Promise<string> {
  const { data: existing } = await sb.from("carts").select("id").eq("buyer_id", buyerId).maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await sb.from("carts").insert({ buyer_id: buyerId }).select("id").single();
  if (error || !created) throw new Error(error?.message || "Could not create cart");
  return created.id;
}

export async function addToCart(buyerId: string, productId: string, quantity = 1) {
  const cartId = await ensureCart(buyerId);
  const { data: existing } = await sb.from("cart_items").select("id,quantity").eq("cart_id", cartId).eq("product_id", productId).maybeSingle();
  if (existing) {
    const { error } = await sb.from("cart_items").update({ quantity: existing.quantity + quantity }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from("cart_items").insert({ cart_id: cartId, product_id: productId, quantity });
    if (error) throw new Error(error.message);
  }
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  if (quantity <= 0) return removeCartItem(itemId);
  const { error } = await sb.from("cart_items").update({ quantity }).eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function removeCartItem(itemId: string) {
  const { error } = await sb.from("cart_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function loadCart(buyerId: string): Promise<(CartItem & { product: Product })[]> {
  const { data: cart } = await sb.from("carts").select("id").eq("buyer_id", buyerId).maybeSingle();
  if (!cart) return [];
  const { data: items } = await sb.from("cart_items")
    .select("*, product:product_id(*)")
    .eq("cart_id", cart.id)
    .order("added_at", { ascending: true });
  return (items as any[]) || [];
}

export async function clearCart(buyerId: string) {
  const { data: cart } = await sb.from("carts").select("id").eq("buyer_id", buyerId).maybeSingle();
  if (!cart) return;
  await sb.from("cart_items").delete().eq("cart_id", cart.id);
}
