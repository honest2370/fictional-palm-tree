import React from "react";

export function Button({
  children, onClick, type = "button", variant = "primary", size = "md", disabled, className = "", fullWidth,
}: {
  children: React.ReactNode; onClick?: () => void; type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger" | "success"; size?: "sm" | "md"; disabled?: boolean; className?: string; fullWidth?: boolean;
}) {
  const base = "rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";
  const sizes: Record<string, string> = { sm: "text-xs px-3 py-2", md: "text-sm px-4 py-3" };
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
  };
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  label, value, onChange, type = "text", placeholder, required, error,
}: {
  label?: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; required?: boolean; error?: string | null;
}) {
  return (
    <div className="mb-4">
      {label && <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>}
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-500 ${error ? "border-red-400" : "border-slate-200"}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function Textarea({
  label, value, onChange, placeholder, required, rows = 4, error,
}: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; rows?: number; error?: string | null;
}) {
  return (
    <div className="mb-4">
      {label && <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>}
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} rows={rows}
        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none ${error ? "border-red-400" : "border-slate-200"}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function StarRating({ value, onChange, readOnly, size = 20 }: { value: number; onChange?: (v: number) => void; readOnly?: boolean; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={n <= value ? "#f59e0b" : "none"} stroke="#f59e0b" strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 ${className}`}>{children}</div>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <div className={`w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />;
}

export function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "green" | "red" | "amber" | "slate" }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", slate: "bg-slate-100 text-slate-600",
  };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${colors[color]}`}>{children}</span>;
}

let toastListeners: ((msg: string, type: "success" | "error") => void)[] = [];
export function onToast(fn: (msg: string, type: "success" | "error") => void) {
  toastListeners.push(fn);
  return () => { toastListeners = toastListeners.filter((f) => f !== fn); };
}
export function showToast(msg: string, type: "success" | "error" = "success") {
  toastListeners.forEach((fn) => fn(msg, type));
}

export function ToastHost() {
  const [toasts, setToasts] = React.useState<{ id: number; msg: string; type: "success" | "error" }[]>([]);
  React.useEffect(() => {
    return onToast((msg, type) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, msg, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    });
  }, []);
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 w-[92%] max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${t.type === "error" ? "bg-red-600 text-white" : "bg-slate-900 text-white"}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
