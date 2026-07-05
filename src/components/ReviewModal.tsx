import React, { useState } from "react";
import { sb } from "@/lib/supabase";
import { Button, Textarea, Input, StarRating, showToast } from "@/components/ui";
import { X } from "lucide-react";

export default function ReviewModal({
  productId, orderId, buyerName, buyerId, onClose, onSubmitted,
}: {
  productId: string; orderId: string; buyerName: string; buyerId: string | null;
  onClose: () => void; onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    const { error } = await sb.from("reviews").insert({
      product_id: productId, order_id: orderId, buyer_id: buyerId, buyer_name: buyerName,
      rating, title: title || null, body: body || null, is_verified_purchase: true,
    });
    setSubmitting(false);
    if (error) {
      showToast(error.message.includes("duplicate") ? "You already reviewed this order" : error.message, "error");
      return;
    }
    showToast("Review submitted, thank you!", "success");
    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-slate-900">Leave a review</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="flex justify-center mb-4">
          <StarRating value={rating} onChange={setRating} size={28} />
        </div>
        <Input label="Title (optional)" value={title} onChange={setTitle} placeholder="Great product!" />
        <Textarea label="Your review (optional)" value={body} onChange={setBody} placeholder="Share your experience…" rows={4} />
        <Button fullWidth disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit review"}</Button>
      </div>
    </div>
  );
}
