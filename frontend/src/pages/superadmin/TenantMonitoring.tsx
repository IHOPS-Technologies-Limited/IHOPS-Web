import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import { Badge, EmptyState } from "../../components/ui";
import { darkInput } from "../../components/superadmin/styles";
import { Search, Building2 } from "lucide-react";

export default function TenantMonitoring() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    superAdminApi.get("/internal/tenants").then((r) => setTenants(r.tenants));
  }, []);

  const filtered = tenants.filter((t) =>
    t.hospitalName.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-white">
          Subscription Monitoring
        </h1>
        <p className="text-sm text-slate-400">
          Every hospital on the platform, at a glance
        </p>
      </div>

      <div className="relative max-w-sm mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          className={`${darkInput} pl-9`}
          placeholder="Search hospitals…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#111827] border border-white/10 rounded-xl py-12 text-center text-slate-500">
          No hospitals found
        </div>
      ) : (
        <div className="bg-[#111827] border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Hospital</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Billing</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <Building2 size={13} />
                      </span>
                      {t.hospitalName}
                    </div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-300">
                    {t.plan?.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-300">
                    {t.billingCycle}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        t.status === "active"
                          ? "teal"
                          : t.status === "suspended"
                            ? "alert"
                            : "amber"
                      }
                    >
                      {t.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
