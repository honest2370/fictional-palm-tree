import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Home, ShoppingCart, ShoppingBag, User } from "lucide-react";
import InstallBanner from "@/components/InstallBanner";

export default function BuyerLayout() {
  const navItem = (to: string, icon: React.ReactNode, label: string, end?: boolean) => (
    <NavLink to={to} end={end} className={({ isActive }) => `flex flex-col items-center gap-1 py-2 flex-1 ${isActive ? "text-blue-600" : "text-slate-400"}`}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <InstallBanner />
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex z-[800]">
        {navItem("/buyer", <Home size={20} />, "Browse", true)}
        {navItem("/buyer/orders", <ShoppingBag size={20} />, "Orders")}
        {navItem("/buyer/cart", <ShoppingCart size={20} />, "Cart")}
        {navItem("/buyer/account", <User size={20} />, "Account")}
      </nav>
    </div>
  );
}
