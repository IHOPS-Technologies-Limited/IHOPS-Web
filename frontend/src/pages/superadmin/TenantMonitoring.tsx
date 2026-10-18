import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { superAdminApi } from "../../api/client";
import { darkInput } from "../../components/superadmin/styles";
import {
  PageHeader,
  StatusBadge,
  DarkBadge,
  NoticeBar,
  Notice,
  errText,
  fmtDate,
  titleCase,
} from "../../components/superadmin/ui";
import { Search, Building2 } from "lucide-react";

const STATUS_FILTERS = [
  "",
  "active",
  "trialing",
  "grace_period",
  "suspended",
  "pending_verification",
  "pending_approval",
  "rejected",
];

// Hospitals list — the entry point to every account-level action. Click a row
// to open the hospital's management page.
export default function TenantMonitoring() {
  const nav = useNavigate();
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    // Debounce typing so every keystroke isn't a request.
    const t = setTimeout(() => {
      setLoading(true);
      superAdminApi
        .get(
          `/internal/hospitals?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`,
        )
        .then((r) => {
          setHospitals(r.hospitals);
          setNotice(null);
        })
        .catch((e) => setNotice({ kind: "error", text: errText(e) }))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status]);

  return (
    <div>
      <PageHeader
        title="Hospitals"
        sub="Every hospital on the platform — open one to manage its account"
      />
      <NoticeBar notice={notice} />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            className={`${darkInput} pl-9`}
            placeholder="Search name, email, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className={`${darkInput} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s ? titleCase(s) : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {loading && hospitals.length === 0 ? (
        <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>
      ) : hospitals.length === 0 ? (
        <div className="bg-[#111827] border border-white/10 rounded-xl py-12 text-center text-slate-500">
          No hospitals found
        </div>
      ) : (
        <div className="bg-[#111827] border border-white/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-slate-200">
            <thead>
              <tr className="text-left text-slate-500 border-b border-white/10">
                <th className="px-4 py-3 font-medium">Hospital</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium text-right">Staff</th>
                <th className="px-4 py-3 font-medium text-right">Patients</th>
                <th className="px-4 py-3 font-medium text-right">SMS units</th>
                <th className="px-4 py-3 font-medium">Setup</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => nav(`/internal/hospitals/${t.id}`)}
                  className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <Building2 size={13} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">
                          {t.hospitalName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {t.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-300">
                    {titleCase(t.plan)}
                    {t.billingCycle && t.billingCycle !== "none" && (
                      <span className="text-slate-500">
                        {" "}
                        · {t.billingCycle}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {t.staffCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {t.patientCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {t.smsBalance}
                  </td>
                  <td className="px-4 py-3">
                    {t.setupWizardCompleted ? (
                      <DarkBadge tone="green">Done</DarkBadge>
                    ) : (
                      <DarkBadge tone="amber">Not finished</DarkBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {fmtDate(t.createdAt, false)}
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
