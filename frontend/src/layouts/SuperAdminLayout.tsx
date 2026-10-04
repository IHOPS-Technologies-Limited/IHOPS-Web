import React, { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  Building2,
  BarChart3,
  Megaphone,
  LifeBuoy,
  LogOut,
  ShieldCheck,
  Bell,
  Mail,
  ChevronDown,
} from "lucide-react";
import { getSuperAdminToken, superAdminApi } from "../api/client";

const NAV = [
  { to: "/internal/approvals", label: "Approval Queue", icon: ClipboardCheck },
  { to: "/internal/tenants", label: "Subscriptions", icon: Building2 },
  { to: "/internal/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/internal/announcements", label: "Announcements", icon: Megaphone },
  { to: "/internal/support", label: "Support Requests", icon: LifeBuoy },
];

export default function SuperAdminLayout() {
  const nav = useNavigate();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const name = localStorage.getItem("ihops_superadmin_name") || "Super Admin";

  useEffect(() => {
    if (!getSuperAdminToken()) return;
    function load() {
      superAdminApi
        .get("/internal/approvals")
        .then((r) => setPendingApprovals(r.applications.length))
        .catch(() => {});
      superAdminApi
        .get("/internal/support-tickets")
        .then((r) =>
          setOpenTickets(
            r.tickets.filter((t: any) => t.status !== "resolved").length,
          ),
        )
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!getSuperAdminToken()) return <Navigate to="/internal/login" replace />;

  function logout() {
    localStorage.removeItem("ihops_superadmin_token");
    localStorage.removeItem("ihops_superadmin_name");
    nav("/internal/login");
  }

  return (
    <div className="min-h-screen flex bg-[#0B1220] text-slate-200">
      <aside className="hidden md:flex md:w-64 shrink-0 bg-[#070D18] border-r border-white/5 flex-col">
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-2 text-white">
            <span className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
              <ShieldCheck size={18} className="text-slate-950" />
            </span>
            <div className="leading-tight">
              <div className="font-display font-extrabold text-base">
                IHOPS Internal
              </div>
              <div className="text-[10px] text-slate-400">
                Platform Operations Console
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-amber-500 text-slate-950"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
              {item.to === "/internal/approvals" && pendingApprovals > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {pendingApprovals}
                </span>
              )}
              {item.to === "/internal/support" && openTickets > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {openTickets}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-xs text-slate-400 hover:text-white px-2 py-2"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-[#0B1220]/95 backdrop-blur border-b border-white/5 flex items-center gap-3 px-4 md:px-6 sticky top-0 z-30">
          <div className="md:hidden font-display font-extrabold text-white">
            IHOPS Internal
          </div>
          <div className="flex-1" />

          <div className="relative">
            <span className="relative w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center text-slate-300">
              <Bell size={18} />
              {pendingApprovals > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {pendingApprovals}
                </span>
              )}
            </span>
          </div>
          <div className="relative">
            <span className="relative w-9 h-9 rounded-full hover:bg-white/5 flex items-center justify-center text-slate-300">
              <Mail size={18} />
              {openTickets > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {openTickets}
                </span>
              )}
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/5"
            >
              <span className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center">
                {name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase())
                  .join("")}
              </span>
              <span className="hidden md:block text-sm font-medium text-slate-200">
                {name}
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-[#111827] border border-white/10 rounded-xl shadow-xl py-1 z-40">
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 flex items-center gap-2"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
