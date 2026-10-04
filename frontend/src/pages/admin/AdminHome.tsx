import React from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CreditCard,
  SlidersHorizontal,
  LifeBuoy,
  BarChart3,
} from "lucide-react";

const CARDS = [
  {
    to: "/app/workforce",
    title: "Staff & Roles",
    desc: "Manage staff accounts, PINs, and permissions",
    icon: Users,
    tint: "bg-blue-50 text-blue-600",
  },
  {
    to: "/app/reports",
    title: "Reports",
    desc: "Finance, attendance, and patient reports in one place",
    icon: BarChart3,
    tint: "bg-purple-50 text-purple-600",
  },
  {
    to: "/app/admin/subscription",
    title: "Subscription & Billing",
    desc: "Plan, billing cycle, and payment history",
    icon: CreditCard,
    tint: "bg-emerald-50 text-emerald-600",
  },
  {
    to: "/app/admin/settings",
    title: "Hospital Settings",
    desc: "Working hours, departments, communication defaults",
    icon: SlidersHorizontal,
    tint: "bg-amber-50 text-amber-600",
  },
  {
    to: "/app/admin/support",
    title: "Support",
    desc: "Raise a ticket with the IHOPS team",
    icon: LifeBuoy,
    tint: "bg-red-50 text-red-500",
  },
];

export default function AdminHome() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-slate-800">
          Admin
        </h1>
        <p className="text-sm text-slate-500">
          Hospital-wide settings and management
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="bg-white rounded-xl border border-slate-100 p-5 flex items-start gap-4 hover:border-blue-200 hover:shadow-sm transition"
          >
            <span
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${c.tint}`}
            >
              <c.icon size={20} />
            </span>
            <div>
              <div className="font-display font-bold text-slate-800">
                {c.title}
              </div>
              <div className="text-sm text-slate-500 mt-0.5">{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
