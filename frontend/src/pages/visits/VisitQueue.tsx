import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from "recharts";
import {
  Users,
  Clock as ClockIcon,
  Activity,
  CheckCircle2,
  Timer,
  Plus,
  PhoneCall,
} from "lucide-react";
import { api } from "../../api/client";
import { Badge, EmptyState, Modal, ErrorBanner } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import CloseVisitModal from "./CloseVisitModal";
import ClinicalUpdateModal from "./ClinicalUpdateModal";
// Added for Module 5 — purely additive, existing buttons/modals above are untouched.
import ClinicalNoteModal from "../../components/clinical/ClinicalNoteModal";
import CommunicationPayloadModal from "../../components/clinical/CommunicationPayloadModal";

const TABS = [
  { key: "queue", label: "Queue" },
  { key: "active", label: "Active Visits" },
  { key: "all", label: "All Visits" },
  { key: "completed", label: "Completed" },
];

const MIX_COLORS = ["#3B82F6", "#94A3B8"]; // new, returning

function ageOf(dob: string) {
  const d = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function waitTone(mins: number | null) {
  if (mins === null) return "text-slate-400";
  if (mins >= 25) return "text-red-500";
  if (mins >= 10) return "text-amber-500";
  return "text-emerald-600";
}

function groupDoctorsByDepartment(doctors: any[], departments: any[]) {
  const nameById = new Map(departments.map((d) => [d.id, d.name]));
  const groups = new Map<string, any[]>();
  for (const d of doctors) {
    const label =
      (d.departmentId && nameById.get(d.departmentId)) ||
      "No department assigned";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(d);
  }
  return Array.from(groups.entries()).map(([label, docs]) => ({
    label,
    doctors: docs,
  }));
}

export default function VisitQueue() {
  const { staff } = useAuth();
  const [params] = useSearchParams();
  const [tab, setTab] = useState("queue");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [visits, setVisits] = useState<any[]>([]);
  const [completedPreview, setCompletedPreview] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [showStart, setShowStart] = useState(!!params.get("startFor"));
  const [error, setError] = useState<string | null>(null);
  const [activeVisit, setActiveVisit] = useState<any>(null);
  const [closingVisit, setClosingVisit] = useState<any>(null);
  // Added for Module 5
  const [clinicalNoteVisit, setClinicalNoteVisit] = useState<any>(null);
  const [payloadNoteId, setPayloadNoteId] = useState<string | null>(null);

  const canStart =
    staff && ["administrator", "receptionist"].includes(staff.role);
  const canUpdateClinical =
    staff && ["administrator", "doctor"].includes(staff.role);
  const canClose =
    staff && ["administrator", "doctor", "receptionist"].includes(staff.role);
  const canCallNext =
    staff && ["administrator", "doctor", "receptionist"].includes(staff.role);
  // Clinical Notes are intentionally NOT granted to "administrator" by
  // default — see backend/src/config/permissions.ts for why.
  const canWriteClinicalNote = staff && ["doctor"].includes(staff.role);

  async function load() {
    const res = await api.get(
      `/visits?scope=${tab}${departmentFilter ? `&departmentId=${departmentFilter}` : ""}`,
    );
    setVisits(res.visits);
  }
  async function loadSidebar() {
    const [ins, completed] = await Promise.all([
      api.get("/visits/queue-insights"),
      api.get("/visits?scope=completed"),
    ]);
    setInsights(ins);
    setCompletedPreview(completed.visits.slice(-3).reverse());
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, departmentFilter]);

  useEffect(() => {
    loadSidebar();
    api
      .get("/workforce/departments")
      .then((r) => setDepartments(r.departments));
    const interval = setInterval(loadSidebar, 15000);
    return () => clearInterval(interval);
  }, []);

  async function startVisit(
    patientId: string,
    departmentId?: string,
    doctorId?: string,
  ) {
    setError(null);
    try {
      await api.post("/visits", { patientId, departmentId, doctorId });
      setShowStart(false);
      load();
      loadSidebar();
    } catch (e: any) {
      if (e.status === 409) setError(e.data.message);
      else setError(e.message);
    }
  }

  async function callNext(visitId: string) {
    await api.post(`/visits/${visitId}/call`, {});
    load();
    loadSidebar();
  }

  const STATS = insights
    ? [
        {
          label: "Total Walk-ins",
          value: insights.totalWalkInsToday,
          sub: "All locations",
          icon: Users,
          tint: "bg-blue-50 text-blue-600",
        },
        {
          label: "Currently Waiting",
          value: insights.currentlyWaiting,
          sub: `${insights.inConsultation} in consultation`,
          icon: ClockIcon,
          tint: "bg-amber-50 text-amber-600",
        },
        {
          label: "In Consultation",
          value: insights.inConsultation,
          sub: "Across all doctors",
          icon: Activity,
          tint: "bg-purple-50 text-purple-600",
        },
        {
          label: "Completed Today",
          value: insights.completedToday,
          sub: `${insights.completedPct}% of walk-ins`,
          icon: CheckCircle2,
          tint: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Average Wait Time",
          value: `${insights.avgWaitMinutes} mins`,
          sub: "Today",
          icon: Timer,
          tint: "bg-red-50 text-red-500",
        },
      ]
    : [];

  const mixData = insights
    ? [
        { name: "New Patient", value: insights.visitMixToday.newPatients },
        { name: "Returning", value: insights.visitMixToday.returning },
      ]
    : [];
  const mixTotal = mixData.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-800">
            Visits & Queue
          </h1>
          <p className="text-sm text-slate-500">
            Manage today's patient queue and visit flow
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 bg-white">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </div>
          {canStart && (
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
              onClick={() => setShowStart(true)}
            >
              <Plus size={16} /> New Walk-in
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {insights && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {STATS.map((s) => (
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
              <div className="text-xl font-mono font-semibold text-slate-800 mt-0.5">
                {s.value}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      <ErrorBanner message={error} />

      <div className="grid xl:grid-cols-[1fr_300px] gap-6 items-start">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-slate-200 pb-0">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {departments.length > 0 && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="border border-slate-200 rounded-lg text-sm px-3 py-1.5 mb-2 text-slate-600 bg-white"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 mb-6">
            <h3 className="font-display font-bold text-slate-800 mb-3">
              {TABS.find((t) => t.key === tab)?.label}{" "}
              <span className="text-blue-600 font-normal text-sm">
                ({visits.length} {tab === "queue" ? "waiting" : "visits"})
              </span>
            </h3>

            {visits.length === 0 ? (
              <EmptyState
                title="Nothing here right now"
                sub={
                  tab === "queue"
                    ? "Start a walk-in to add someone to the queue."
                    : "No visits match this view yet."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-100">
                      <th className="px-2 py-2 font-medium">#</th>
                      <th className="px-2 py-2 font-medium">Patient</th>
                      <th className="px-2 py-2 font-medium">Token No.</th>
                      <th className="px-2 py-2 font-medium">Type</th>
                      <th className="px-2 py-2 font-medium">Arrival Time</th>
                      <th className="px-2 py-2 font-medium">Wait Time</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v, i) => (
                      <tr
                        key={v.id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="px-2 py-3 text-slate-400">{i + 1}</td>
                        <td className="px-2 py-3">
                          <div className="font-medium text-slate-700">
                            {v.patient.name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {ageOf(v.patient.dob)} Y / {v.patient.gender?.[0]}
                          </div>
                        </td>
                        <td className="px-2 py-3 font-mono text-xs text-slate-500">
                          {v.tokenNo}
                        </td>
                        <td className="px-2 py-3">
                          <Badge tone={v.isNewPatient ? "amber" : "gray"}>
                            {v.isNewPatient ? "New Patient" : "Returning"}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 text-slate-500">
                          {new Date(v.startedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td
                          className={`px-2 py-3 font-medium ${waitTone(v.waitMinutes)}`}
                        >
                          {v.waitMinutes != null
                            ? `${v.waitMinutes} mins`
                            : "—"}
                        </td>
                        <td className="px-2 py-3">
                          <Badge
                            tone={
                              v.status === "waiting"
                                ? "amber"
                                : v.status === "closed"
                                  ? "gray"
                                  : "teal"
                            }
                          >
                            {v.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            {v.status === "waiting" && canCallNext && (
                              <button
                                onClick={() => callNext(v.id)}
                                className="border border-blue-200 text-blue-600 text-xs font-medium rounded-lg px-2.5 py-1.5 flex items-center gap-1 hover:bg-blue-50"
                              >
                                <PhoneCall size={12} /> Call Next
                              </button>
                            )}
                            {canUpdateClinical && (
                              <button
                                className="text-xs text-slate-500 hover:text-blue-600"
                                onClick={() => setActiveVisit(v)}
                              >
                                Update
                              </button>
                            )}
                            {canWriteClinicalNote && (
                              <button
                                className="text-xs text-slate-500 hover:text-blue-600"
                                onClick={() => setClinicalNoteVisit(v)}
                              >
                                Note
                              </button>
                            )}
                            {canClose && v.status !== "closed" && (
                              <button
                                className="text-xs text-amber-600 hover:text-amber-700"
                                onClick={() => setClosingVisit(v)}
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Completed Visits */}
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-display font-bold text-slate-800">
                Recent Completed Visits
              </h3>
              <button
                onClick={() => setTab("completed")}
                className="text-blue-600 text-xs font-medium"
              >
                View all completed →
              </button>
            </div>
            {completedPreview.length === 0 ? (
              <EmptyState title="No completed visits yet today" />
            ) : (
              <div className="space-y-2">
                {completedPreview.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 text-sm border-b border-slate-50 last:border-0 pb-2 last:pb-0"
                  >
                    <div className="w-14 shrink-0 text-slate-400 text-xs font-mono">
                      {v.closedAt
                        ? new Date(v.closedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                    <Badge tone={v.isNewPatient ? "amber" : "gray"}>
                      {v.isNewPatient ? "New Patient" : "Returning"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-700 truncate">
                        {v.patient.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {v.doctor ? `Dr. ${v.doctor.name}` : "Unassigned"}
                        {v.department ? ` · ${v.department.name}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        {insights && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="font-display font-bold text-slate-800 text-sm mb-3">
                Doctors on Duty
              </h3>
              {insights.doctorsOnDuty.length === 0 ? (
                <EmptyState title="No doctors registered" />
              ) : (
                <div className="space-y-4">
                  {groupDoctorsByDepartment(
                    insights.doctorsOnDuty,
                    departments,
                  ).map((group) => (
                    <div key={group.label}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                        {group.label}
                      </div>
                      <div className="space-y-2.5">
                        {group.doctors.map((d: any) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <div>
                              <div className="font-medium text-slate-700">
                                {d.name}
                              </div>
                              <div className="text-xs text-slate-400">
                                {d.seenToday} seen today
                              </div>
                            </div>
                            <Badge
                              tone={
                                d.status === "in_consultation"
                                  ? "teal"
                                  : d.status === "available"
                                    ? "amber"
                                    : "gray"
                              }
                            >
                              {d.status === "in_consultation"
                                ? "In Consultation"
                                : d.status === "available"
                                  ? "Available"
                                  : "Off Duty"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="font-display font-bold text-slate-800 text-sm mb-3">
                Queue Insights
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center mb-1">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Peak Hour
                  </div>
                  <div className="text-sm font-mono font-semibold text-slate-700">
                    {insights.peakHour || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Longest Wait
                  </div>
                  <div className="text-sm font-mono font-semibold text-slate-700">
                    {insights.longestWaitMinutes}m
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                    Avg. Consult
                  </div>
                  <div className="text-sm font-mono font-semibold text-slate-700">
                    {insights.avgConsultationMinutes}m
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-4">
              <h3 className="font-display font-bold text-slate-800 text-sm mb-3">
                New vs Returning (Today)
              </h3>
              {mixTotal === 0 ? (
                <EmptyState title="No visits yet today" />
              ) : (
                <>
                  <div className="h-32 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={mixData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={35}
                          outerRadius={52}
                          paddingAngle={3}
                        >
                          {mixData.map((_, i) => (
                            <Cell key={i} fill={MIX_COLORS[i]} />
                          ))}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 mt-2 text-xs">
                    {mixData.map((d, i) => (
                      <div
                        key={d.name}
                        className="flex justify-between items-center"
                      >
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: MIX_COLORS[i] }}
                          />
                          {d.name}
                        </span>
                        <span className="text-slate-400">
                          {d.value} (
                          {mixTotal
                            ? Math.round((d.value / mixTotal) * 100)
                            : 0}
                          %)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={showStart}
        onClose={() => setShowStart(false)}
        title="Start a walk-in visit"
      >
        <ErrorBanner message={error} />
        <PatientPicker
          onStart={(patientId, departmentId, doctorId) =>
            startVisit(patientId, departmentId, doctorId)
          }
          defaultPatientId={params.get("startFor") || undefined}
          departments={departments}
        />
      </Modal>

      {activeVisit && (
        <ClinicalUpdateModal
          visit={activeVisit}
          onClose={() => setActiveVisit(null)}
          onSaved={() => {
            setActiveVisit(null);
            load();
          }}
        />
      )}
      {closingVisit && (
        <CloseVisitModal
          visit={closingVisit}
          onClose={() => setClosingVisit(null)}
          onSaved={() => {
            setClosingVisit(null);
            load();
            loadSidebar();
          }}
        />
      )}

      {/* Added for Module 5 */}
      {clinicalNoteVisit && (
        <ClinicalNoteModal
          visit={clinicalNoteVisit}
          onClose={() => setClinicalNoteVisit(null)}
          onSaved={async () => {
            const res = await api.get(
              `/clinical/visits/${clinicalNoteVisit.id}/notes`,
            );
            const noteId = res.note?.id;
            const followUpRequired = res.note?.followUpRequired;
            setClinicalNoteVisit(null);
            load();
            if (noteId && followUpRequired && res.note.status === "finalized")
              setPayloadNoteId(noteId);
          }}
        />
      )}
      {payloadNoteId && (
        <CommunicationPayloadModal
          noteId={payloadNoteId}
          onClose={() => setPayloadNoteId(null)}
          onDone={() => setPayloadNoteId(null)}
        />
      )}
    </div>
  );
}

function PatientPicker({
  onStart,
  defaultPatientId,
  departments,
}: {
  onStart: (
    patientId: string,
    departmentId?: string,
    doctorId?: string,
  ) => void;
  defaultPatientId?: string;
  departments: any[];
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [doctors, setDoctors] = useState<any[]>([]);

  useEffect(() => {
    if (defaultPatientId) {
      api
        .get(`/patients/${defaultPatientId}`)
        .then((r) => setSelected(r.patient));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!q || selected) return setResults([]);
    const t = setTimeout(
      () =>
        api
          .get(`/patients?q=${encodeURIComponent(q)}`)
          .then((r) => setResults(r.patients)),
      250,
    );
    return () => clearTimeout(t);
  }, [q, selected]);

  // Fetched fresh from the backend every time the department selection
  // changes — filtered server-side with ?departmentId=, rather than
  // filtering a doctors list fetched once elsewhere and passed down. That
  // older approach could still show a doctor whose department had just been
  // reassigned (e.g. via Staff Directory) until this modal happened to
  // refetch; querying live per selection removes that staleness entirely.
  useEffect(() => {
    const url = departmentId
      ? `/workforce/doctors?departmentId=${departmentId}`
      : "/workforce/doctors";
    api
      .get(url)
      .then((r) => setDoctors(r.doctors))
      .catch(() => setDoctors([]));
  }, [departmentId]);

  if (!selected) {
    return (
      <div>
        <input
          className="input mb-3"
          placeholder="Search patient by name or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm flex justify-between"
              onClick={() => setSelected(p)}
            >
              <span>{p.name}</span>
              <span className="text-slate-400 font-mono text-xs">
                {p.platformPatientId}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2 text-sm">
        <span className="font-medium">{selected.name}</span>
        <button
          className="text-xs text-blue-600"
          onClick={() => setSelected(null)}
        >
          Change
        </button>
      </div>
      <div>
        <label className="label">Department (optional)</label>
        <select
          className="input"
          value={departmentId}
          onChange={(e) => {
            setDepartmentId(e.target.value);
            setDoctorId("");
          }}
        >
          <option value="">— Not assigned —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">
          Doctor (optional — can be assigned later)
        </label>
        <select
          className="input"
          value={doctorId}
          onChange={(e) => setDoctorId(e.target.value)}
        >
          <option value="">— Unassigned —</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.name}
            </option>
          ))}
        </select>
        {departmentId && doctors.length === 0 && (
          <p className="text-xs text-slate-400 mt-1">
            No doctors are assigned to this department yet — you can still leave
            this unassigned.
          </p>
        )}
      </div>
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full transition"
        onClick={() =>
          onStart(selected.id, departmentId || undefined, doctorId || undefined)
        }
      >
        Start visit
      </button>
    </div>
  );
}
