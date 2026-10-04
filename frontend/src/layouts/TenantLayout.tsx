import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  MessageCircle,
  Wallet,
  UserCog,
  Clock,
  Settings,
  Search,
  Bell,
  Mail,
  HelpCircle,
  ChevronDown,
  LogOut,
  Building2,
  Menu,
  X,
  BarChart3,
  Home,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { LoadingScreen } from "../components/ui";

const NAV = [
  {
    to: "/app/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [
      "administrator",
      "doctor",
      "receptionist",
      "finance_officer",
      "nurse",
    ],
  },
  {
    to: "/app/patients",
    label: "Patients",
    icon: Users,
    roles: ["administrator", "doctor", "receptionist", "finance_officer"],
  },
  {
    to: "/app/families",
    label: "Families",
    icon: Home,
    roles: ["administrator", "doctor", "receptionist", "finance_officer"],
  },
  {
    to: "/app/visits",
    label: "Visits & Queue",
    icon: ClipboardList,
    roles: ["administrator", "doctor", "receptionist"],
  },
  {
    to: "/app/communication",
    label: "Communication",
    icon: MessageCircle,
    roles: ["administrator", "doctor", "receptionist"],
  },
  {
    to: "/app/finance",
    label: "Finance",
    icon: Wallet,
    roles: ["administrator", "finance_officer"],
  },
  // Reports aggregates finance data, so it's scoped the same as Finance itself.
  {
    to: "/app/reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["administrator"],
  },
  {
    to: "/app/workforce",
    label: "Workforce",
    icon: UserCog,
    roles: ["administrator"],
  },
  {
    to: "/app/attendance",
    label: "Attendance",
    icon: Clock,
    roles: [
      "administrator",
      "doctor",
      "receptionist",
      "finance_officer",
      "nurse",
    ],
  },
  {
    to: "/app/admin",
    label: "Admin",
    icon: Settings,
    roles: ["administrator"],
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function TenantLayout() {
  const { staff, tenant, loading, logout } = useAuth();
  const nav = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<
    { visitId: string; patient: string; message: string }[]
  >([]);
  const [openTickets, setOpenTickets] = useState<any[]>([]);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!staff || staff.role === "doctor") return;
    const load = () =>
      api
        .get("/dashboard")
        .then((res) => setAlerts(res.alerts || []))
        .catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [staff]);

  useEffect(() => {
    if (!staff) return;
    // Real, tenant-wide open/in-progress support tickets — not a fabricated
    // "unread messages" count. Every role can raise a ticket, so every role
    // can see this. Polled rather than fetched once, so a new reply from
    // the IHOPS team shows up without needing a page reload.
    const load = () =>
      api
        .get("/support-tickets")
        .then((res) =>
          setOpenTickets(
            (res.tickets || []).filter((t: any) => t.status !== "resolved"),
          ),
        )
        .catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [staff]);

  if (loading) return <LoadingScreen />;
  if (!staff) return <Navigate to="/login" replace />;

  const restricted =
    tenant &&
    [
      "suspended",
      "pending_approval",
      "pending_verification",
      "rejected",
    ].includes(tenant.status);
  if (restricted) return <Navigate to="/account-restricted" replace />;
  if (tenant && !tenant.setupWizardCompleted && staff.role === "administrator")
    return <Navigate to="/setup" replace />;
  if (staff.mustChangePin) return <Navigate to="/change-pin" replace />;

  const items = NAV.filter((n) => n.roles.includes(staff.role));

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchRef.current?.value.trim();
    if (q) nav(`/app/patients?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ---------------- Sidebar ---------------- */}
      <aside className="hidden md:flex md:w-64 shrink-0 bg-[#0B1220] text-slate-300 flex-col">
        <div className="px-5 py-6 border-b border-white/5">
          <div className="flex items-center gap-2 text-white">
            <span className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-display font-extrabold text-sm">
              IH
            </span>
            <div className="leading-tight">
              <div className="font-display font-extrabold text-base">IHOPS</div>
              <div className="text-[10px] text-slate-400">
                Intelligent Hospital Operation System
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={16} className="text-slate-400" />
              <span className="text-sm font-semibold text-white truncate">
                {tenant?.hospitalName}
              </span>
            </div>
            <div className="text-xs text-slate-400 mb-3">
              {tenant?.hospitalType}
            </div>
            <NavLink
              to="/app/admin"
              className="block text-center text-xs font-medium bg-white/10 hover:bg-white/15 text-white rounded-lg py-2 transition"
            >
              View Hospital Profile
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#0B1220] text-slate-300 flex flex-col">
            <div className="px-5 py-5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-display font-extrabold text-xs">
                  IH
                </span>
                <span className="font-display font-extrabold">IHOPS</span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="text-slate-400"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive ? "bg-blue-600 text-white" : "text-slate-300"}`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ---------------- Main column ---------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center gap-3 px-4 md:px-6 sticky top-0 z-30">
          <button
            className="md:hidden text-slate-500"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={22} />
          </button>

          <form onSubmit={submitSearch} className="flex-1 max-w-md">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-500 focus-within:ring-2 focus-within:ring-blue-500/30">
              <Search size={16} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search patients, visits…"
                className="bg-transparent flex-1 outline-none text-slate-700 placeholder:text-slate-400"
              />
              <kbd className="hidden md:inline text-[10px] text-slate-400 border border-slate-300 rounded px-1.5 py-0.5">
                Ctrl+K
              </kbd>
            </div>
          </form>

          <div className="flex-1" />

          <NavLink
            to="/app/admin"
            className="hidden lg:flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Building2 size={14} className="text-slate-400" />
            {tenant?.hospitalName}
          </NavLink>

          {staff.role !== "doctor" && (
            <div className="relative">
              <button
                onClick={() => setAlertsOpen((o) => !o)}
                className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <Bell size={18} />
                {alerts.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                    {alerts.length}
                  </span>
                )}
              </button>
              {alertsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-40">
                  <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Alerts
                  </div>
                  {alerts.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-400">
                      Nothing needs attention right now.
                    </div>
                  ) : (
                    alerts.map((a) => (
                      <button
                        key={a.visitId}
                        onClick={() => {
                          setAlertsOpen(false);
                          nav("/app/visits");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                      >
                        <div className="font-medium text-slate-700">
                          {a.patient}
                        </div>
                        <div className="text-xs text-slate-400">
                          {a.message}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setTicketsOpen((o) => !o)}
              className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
            >
              <Mail size={18} />
              {openTickets.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {openTickets.length}
                </span>
              )}
            </button>
            {ticketsOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-40">
                <div className="px-4 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Support Tickets
                </div>
                {openTickets.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    No open tickets.
                  </div>
                ) : (
                  <>
                    {openTickets.slice(0, 5).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setTicketsOpen(false);
                          nav("/app/admin/support");
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                      >
                        <div className="font-medium text-slate-700 truncate">
                          {t.subject}
                        </div>
                        <div className="text-xs text-slate-400 capitalize">
                          {t.status.replace("_", " ")}
                        </div>
                      </button>
                    ))}
                    <NavLink
                      to="/app/admin/support"
                      onClick={() => setTicketsOpen(false)}
                      className="block px-4 py-2 text-xs text-blue-600 font-medium hover:bg-slate-50"
                    >
                      View all tickets →
                    </NavLink>
                  </>
                )}
              </div>
            )}
          </div>

          <NavLink
            to="/app/admin/support"
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
          >
            <HelpCircle size={18} />
          </NavLink>

          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100"
            >
              <span className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center">
                {initials(staff.name)}
              </span>
              <span className="hidden md:block text-left leading-tight">
                <div className="text-sm font-medium text-slate-700">
                  {staff.name}
                </div>
                <div className="text-[11px] text-slate-400 capitalize">
                  {staff.role.replace("_", " ")}
                </div>
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-40">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <div className="text-sm font-medium text-slate-700">
                    {staff.name}
                  </div>
                  {staff.email && (
                    <div className="text-xs text-slate-400 truncate">
                      {staff.email}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 capitalize mt-0.5">
                    {staff.role.replace("_", " ")} · {staff.staffIdDisplay}
                  </div>
                </div>
                {staff.role === "administrator" && (
                  <NavLink
                    to="/app/admin"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    Admin settings
                  </NavLink>
                )}
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>

        <footer className="px-4 md:px-8 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-200">
          <span>© {new Date().getFullYear()} IHOPS. All rights reserved.</span>
          <span className="flex items-center gap-1">
            Secure · Compliant · Built for Nigerian Healthcare
          </span>
        </footer>
      </div>
    </div>
  );
}
