import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import {
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from "lucide-react";

export default function Analytics() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    superAdminApi.get("/internal/analytics").then(setData);
  }, []);

  if (!data) return <div className="text-slate-400">Loading…</div>;

  const cards = [
    {
      label: "Total hospitals",
      value: data.totalTenants,
      icon: Building2,
      tint: "bg-blue-500/10 text-blue-400",
    },
    {
      label: "Active",
      value: data.activeTenants,
      icon: CheckCircle2,
      tint: "bg-emerald-500/10 text-emerald-400",
    },
    {
      label: "Trialing",
      value: data.trialing,
      icon: Clock,
      tint: "bg-amber-500/10 text-amber-400",
    },
    {
      label: "Suspended",
      value: data.churned,
      icon: XCircle,
      tint: "bg-red-500/10 text-red-400",
    },
    {
      label: "Public hospital applications",
      value: data.publicHospitalApplications,
      icon: FileText,
      tint: "bg-purple-500/10 text-purple-400",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-white">
          Platform Analytics
        </h1>
        <p className="text-sm text-slate-400">
          Aggregate numbers across every hospital on IHOPS
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-[#111827] border border-white/10 rounded-xl p-4"
          >
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.tint}`}
            >
              <c.icon size={17} />
            </span>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {c.label}
            </div>
            <div className="text-2xl font-mono font-semibold text-white mt-1">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-display font-bold text-white mb-3">By plan</h2>
      <div className="bg-[#111827] border border-white/10 rounded-xl divide-y divide-white/5">
        {data.revenueByPlan.map((r: any) => (
          <div
            key={r.planCode}
            className="px-4 py-3 flex justify-between text-sm text-slate-300 capitalize"
          >
            <span>{r.planCode.replace("_", " ")}</span>
            <span className="font-mono text-white">
              {r._count.planCode} hospitals
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
