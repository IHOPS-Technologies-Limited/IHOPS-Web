import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import {
  Search,
  UserPlus,
  Users,
  Activity,
  RotateCcw,
  Home,
  Eye,
  ClipboardPlus,
  ChevronLeft,
  ChevronRight,
  Upload,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { api } from "../../api/client";
import { EmptyState, Badge } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";

const SUMMARY_COLORS = ["#22C55E", "#94A3B8", "#EF4444"]; // active, inactive, deceased

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const emptyFilters = {
  status: "all",
  gender: "all",
  ageGroup: "all",
  patientType: "all",
  hasOutstanding: false,
};

export default function PatientDirectory() {
  const { staff } = useAuth();
  const nav = useNavigate();
  const canWrite =
    staff && ["administrator", "receptionist"].includes(staff.role);
  const canStartVisit =
    staff && ["administrator", "receptionist"].includes(staff.role);

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [patients, setPatients] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.gender !== "all") params.set("gender", filters.gender);
    if (filters.ageGroup !== "all") params.set("ageGroup", filters.ageGroup);
    if (filters.patientType !== "all")
      params.set("patientType", filters.patientType);
    if (filters.hasOutstanding) params.set("hasOutstanding", "true");
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    return params.toString();
  }, [q, filters, page, pageSize]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/patients?${queryString}`);
      setPatients(res.patients);
      setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  useEffect(() => {
    api.get("/patients/summary").then(setSummary);
  }, [patients.length]); // refresh summary when the list meaningfully changes (e.g. after import/registration)

  useEffect(() => {
    setPage(1);
  }, [q, filters, pageSize]);

  function resetFilters() {
    setQ("");
    setFilters(emptyFilters);
  }

  const STAT_CARDS = summary
    ? [
        {
          label: "Total Patients",
          value: summary.totalPatients.toLocaleString(),
          sub: "All time",
          icon: Users,
          tint: "bg-blue-50 text-blue-600",
        },
        {
          label: "New This Month",
          value: summary.newThisMonth.toLocaleString(),
          sub: `+${summary.quickFilters.newThisMonth} vs last check`,
          icon: UserPlus,
          tint: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Active Patients",
          value: summary.activePatients.toLocaleString(),
          sub: "Visited in last 12 months",
          icon: Activity,
          tint: "bg-purple-50 text-purple-600",
        },
        {
          label: "Returning Patients",
          value: summary.returningPatients.toLocaleString(),
          sub: `${summary.totalPatients ? Math.round((summary.returningPatients / summary.totalPatients) * 100) : 0}% of total`,
          icon: RotateCcw,
          tint: "bg-amber-50 text-amber-600",
        },
        {
          label: "Families",
          value: summary.families.toLocaleString(),
          sub: "Family groups",
          icon: Home,
          tint: "bg-teal-50 text-teal-600",
        },
        {
          label: "Male : Female",
          value: `${summary.genderRatio.malePct}% : ${summary.genderRatio.femalePct}%`,
          sub: "Gender ratio",
          icon: Users,
          tint: "bg-pink-50 text-pink-600",
        },
      ]
    : [];

  const summaryDonut = summary
    ? [
        { name: "Active", value: summary.patientSummary.active },
        { name: "Inactive", value: summary.patientSummary.inactive },
        { name: "Deceased", value: summary.patientSummary.deceased },
      ]
    : [];
  const summaryTotal = summaryDonut.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-800">
            Patients
          </h1>
          <p className="text-sm text-slate-500">
            Manage and search your patients
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <button
              className="bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition"
              onClick={() => nav("/app/patients/import")}
            >
              <Upload size={15} /> Import Patients
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
              onClick={() => nav("/app/patients/new")}
            >
              <Plus size={15} /> New Patient
            </button>
          </div>
        )}
      </div>

      {/* Stat cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {STAT_CARDS.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-xl border border-slate-100 p-4"
            >
              <span
                className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.tint}`}
              >
                <s.icon size={18} />
              </span>
              <div className="text-xs text-slate-400">{s.label}</div>
              <div className="text-lg font-mono font-semibold text-slate-800 mt-0.5">
                {s.value}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Main column */}
        <div className="min-w-0">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-slate-100 p-3 mb-4 flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]">
              <Search size={15} className="text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search patients…"
                className="bg-transparent outline-none flex-1 text-slate-700 placeholder:text-slate-400"
              />
            </div>
            <FilterSelect
              value={filters.status}
              onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              options={[
                ["all", "All Status"],
                ["active", "Active"],
                ["inactive", "Inactive"],
                ["deceased", "Deceased"],
              ]}
            />
            <FilterSelect
              value={filters.gender}
              onChange={(v) => setFilters((f) => ({ ...f, gender: v }))}
              options={[
                ["all", "All Gender"],
                ["Male", "Male"],
                ["Female", "Female"],
                ["Other", "Other"],
              ]}
            />
            <FilterSelect
              value={filters.ageGroup}
              onChange={(v) => setFilters((f) => ({ ...f, ageGroup: v }))}
              options={[
                ["all", "All Age Groups"],
                ["0-17", "0 – 17 yrs"],
                ["18-35", "18 – 35 yrs"],
                ["36-60", "36 – 60 yrs"],
                ["60+", "60+ yrs"],
              ]}
            />
            <FilterSelect
              value={filters.patientType}
              onChange={(v) => setFilters((f) => ({ ...f, patientType: v }))}
              options={[
                ["all", "All Patients"],
                ["new", "New This Month"],
                ["returning", "Returning"],
              ]}
            />
            <button
              onClick={() =>
                setFilters((f) => ({ ...f, hasOutstanding: !f.hasOutstanding }))
              }
              className={`text-sm rounded-lg px-3 py-2 border transition ${filters.hasOutstanding ? "bg-red-50 border-red-200 text-red-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
            >
              Outstanding Payments
            </button>
            <button
              onClick={resetFilters}
              className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1 px-2"
            >
              <RefreshCcw size={13} /> Reset
            </button>
          </div>

          {loading && patients.length === 0 ? (
            <div className="text-slate-400 text-sm py-8 text-center">
              Loading patients…
            </div>
          ) : patients.length === 0 ? (
            <EmptyState
              title="No patients found"
              sub={
                q || Object.values(filters).some(Boolean)
                  ? "Try different filters."
                  : "Register your first patient to get started."
              }
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Hospital ID</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Age / Gender</th>
                    <th className="px-4 py-3 font-medium">Last Visit</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                            {initials(p.name)}
                          </span>
                          <span className="font-medium text-slate-700">
                            {p.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {p.platformPatientId}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.age != null ? `${p.age} Y` : "—"} / {p.gender}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {p.lastVisit
                          ? new Date(p.lastVisit).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          tone={
                            p.status === "active"
                              ? "teal"
                              : p.status === "deceased"
                                ? "alert"
                                : "gray"
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => nav(`/app/patients/${p.id}`)}
                            className="text-slate-400 hover:text-blue-600"
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                          {canStartVisit && (
                            <button
                              onClick={() =>
                                nav(`/app/visits?startFor=${p.id}`)
                              }
                              className="text-slate-400 hover:text-blue-600"
                              title="Start visit"
                            >
                              <ClipboardPlus size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
                <span>
                  Showing{" "}
                  {pagination.total === 0
                    ? 0
                    : (pagination.page - 1) * pagination.pageSize + 1}{" "}
                  to{" "}
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total,
                  )}{" "}
                  of {pagination.total} patients
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 text-xs">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="border border-slate-200 rounded-lg text-xs px-2 py-1.5"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} / page
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {summary && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="font-display font-bold text-slate-800 text-sm mb-3">
                Quick Filters
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Today's Visits</span>
                  <span className="font-mono text-slate-700">
                    {summary.quickFilters.todaysVisits}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">This Week's Visits</span>
                  <span className="font-mono text-slate-700">
                    {summary.quickFilters.thisWeeksVisits}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, patientType: "new" }))
                  }
                  className="flex justify-between w-full hover:text-blue-600"
                >
                  <span className="text-slate-500">
                    New Patients (This Month)
                  </span>
                  <span className="font-mono text-slate-700">
                    {summary.quickFilters.newThisMonth}
                  </span>
                </button>
                <button
                  onClick={() =>
                    setFilters((f) => ({ ...f, hasOutstanding: true }))
                  }
                  className="flex justify-between w-full text-red-500 hover:text-red-600"
                >
                  <span>Outstanding Payments</span>
                  <span className="font-mono">
                    {summary.quickFilters.outstandingPayments}
                  </span>
                </button>
                <div className="flex justify-between">
                  <span className="text-slate-500">Never Visited</span>
                  <span className="font-mono text-slate-700">
                    {summary.quickFilters.notVisited}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="font-display font-bold text-slate-800 text-sm mb-3">
                Patient Summary
              </h3>
              <div className="h-36 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summaryDonut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={3}
                    >
                      {summaryDonut.map((_, i) => (
                        <Cell key={i} fill={SUMMARY_COLORS[i]} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-lg font-mono font-bold text-slate-800">
                    {summaryTotal.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">Total</div>
                </div>
              </div>
              <div className="space-y-1.5 mt-2 text-xs">
                {summaryDonut.map((d, i) => (
                  <div
                    key={d.name}
                    className="flex justify-between items-center"
                  >
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: SUMMARY_COLORS[i] }}
                      />
                      {d.name}
                    </span>
                    <span className="text-slate-400">
                      {d.value.toLocaleString()} (
                      {summaryTotal
                        ? Math.round((d.value / summaryTotal) * 100)
                        : 0}
                      %)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="font-display font-bold text-slate-800 text-sm mb-3">
                Top Age Groups
              </h3>
              <div className="space-y-2.5">
                {summary.ageGroups.map((g: any) => (
                  <div key={g.label}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{g.label} years</span>
                      <span>{g.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${g.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-slate-200 rounded-lg text-sm px-3 py-2 text-slate-600 bg-white"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
