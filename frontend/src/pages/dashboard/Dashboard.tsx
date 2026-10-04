// import React, { useEffect, useState } from "react";
// import { api } from "../../api/client";
// import { useAuth } from "../../auth/AuthContext";
// import { StatCard, EmptyState, Badge } from "../../components/ui";
// import { Link } from "react-router-dom";

// export default function Dashboard() {
//   const { staff, tenant } = useAuth();
//   const [data, setData] = useState<any>(null);

//   useEffect(() => {
//     api.get("/dashboard").then(setData);
//   }, []);

//   if (!data) return <div className="text-teal-900/50">Loading dashboard…</div>;

//   const trialDaysLeft = tenant?.trialEndsAt
//     ? Math.max(
//         0,
//         Math.ceil(
//           (new Date(tenant.trialEndsAt).getTime() - Date.now()) /
//             (1000 * 60 * 60 * 24),
//         ),
//       )
//     : null;

//   return (
//     <div>
//       <div className="flex justify-between items-start mb-6">
//         <div>
//           <h1 className="text-2xl font-extrabold text-teal-900">
//             Welcome back, {staff?.name?.split(" ")[0]}
//           </h1>
//           <p className="text-sm text-teal-900/60">{tenant?.hospitalName}</p>
//         </div>
//         {tenant?.status === "trialing" && trialDaysLeft !== null && (
//           <Badge tone={trialDaysLeft <= 2 ? "alert" : "amber"}>
//             {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in trial
//           </Badge>
//         )}
//       </div>

//       {data.role === "doctor" ? (
//         <div>
//           <h2 className="font-display font-bold text-teal-900 mb-3">
//             My Queue
//           </h2>
//           {data.myQueue.length === 0 ? (
//             <EmptyState
//               title="No patients waiting"
//               sub="Your queue is clear."
//             />
//           ) : (
//             <div className="space-y-2">
//               {data.myQueue.map((v: any) => (
//                 <Link
//                   to="/app/visits"
//                   key={v.id}
//                   className="card p-4 flex justify-between items-center block hover:border-teal-600"
//                 >
//                   <div>
//                     <div className="font-medium">{v.patient.name}</div>
//                     <div className="text-xs text-teal-900/50">
//                       Started {new Date(v.startedAt).toLocaleTimeString()}
//                     </div>
//                   </div>
//                   <Badge tone={v.status === "waiting" ? "amber" : "teal"}>
//                     {v.status.replace("_", " ")}
//                   </Badge>
//                 </Link>
//               ))}
//             </div>
//           )}
//         </div>
//       ) : (
//         <>
//           <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
//             <StatCard label="Walk-ins today" value={data.walkInsToday} />
//             <StatCard
//               label="Patients waiting"
//               value={data.patientsWaiting}
//               tone="amber"
//             />
//             <StatCard label="Active visits" value={data.activeVisits} />
//             <StatCard label="Follow-ups due today" value={data.followUpsDue} />
//             <StatCard
//               label="Revenue today"
//               value={`₦${data.revenueToday.toLocaleString()}`}
//               tone="teal"
//             />
//             <StatCard label="Staff on duty" value={data.staffOnDuty} />
//           </div>

//           {data.alerts.length > 0 && (
//             <div className="mb-8">
//               <h2 className="font-display font-bold text-teal-900 mb-3">
//                 Alerts
//               </h2>
//               <div className="space-y-2">
//                 {data.alerts.map((a: any) => (
//                   <div
//                     key={a.visitId}
//                     className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-alert"
//                   >
//                     {a.patient}: {a.message}
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           <h2 className="font-display font-bold text-teal-900 mb-3">
//             Recent activity
//           </h2>
//           {data.recentActivity.length === 0 ? (
//             <EmptyState title="No recent activity yet" />
//           ) : (
//             <div className="card divide-y divide-teal-50">
//               {data.recentActivity.map((a: any, i: number) => (
//                 <div key={i} className="px-4 py-3 flex justify-between text-sm">
//                   <span>{a.patient}</span>
//                   <span className="text-teal-900/50">
//                     {a.status.replace("_", " ")} ·{" "}
//                     {new Date(a.startedAt).toLocaleString()}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           )}
//         </>
//       )}
//     </div>
//   );
// }

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Users,
  Activity,
  Clock as ClockIcon,
  Wallet,
  UserCheck,
  Plus,
  Bell,
  UserPlus,
  ClipboardPlus,
  CalendarClock,
  MessageSquare,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { EmptyState, Badge } from "../../components/ui";

const MIX_COLORS = ["#F59E0B", "#3B82F6", "#22C55E"]; // waiting, in consultation, closed today

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function relativeTime(date: string | Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  return new Date(date).toLocaleDateString();
}

export default function Dashboard() {
  const { staff, tenant } = useAuth();
  const [data, setData] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);

  const hasFinanceAccess =
    staff && ["administrator", "finance_officer"].includes(staff.role);

  // Preserved from the previous version — trial countdown badge.
  const trialDaysLeft = tenant?.trialEndsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(tenant.trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  useEffect(() => {
    api.get("/dashboard").then(setData);
  }, []);

  useEffect(() => {
    if (!hasFinanceAccess) return;
    api
      .get("/finance/summary")
      .then(setFinance)
      .catch(() => {});
    api
      .get("/finance/expenses")
      .then((r) => setExpenses(r.expenses.slice(0, 5)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.role]);

  const notifications = useMemo(() => {
    if (!data || data.role === "doctor") return [];
    const fromAlerts = (data.alerts || []).map((a: any) => ({
      key: `alert-${a.visitId}`,
      icon: "alert",
      text: `${a.patient}: ${a.message}`,
      time: null,
    }));
    const fromActivity = (data.recentActivity || [])
      .slice(0, 4)
      .map((v: any) => ({
        key: `activity-${v.visitId}`,
        icon: v.status === "closed" ? "closed" : "visit",
        text:
          v.status === "closed"
            ? `Visit closed for ${v.patient}`
            : `${v.patient} started a visit`,
        time: v.startedAt,
      }));
    return [...fromAlerts, ...fromActivity].slice(0, 6);
  }, [data]);

  if (!data) return <div className="text-slate-400">Loading dashboard…</div>;

  if (data.role === "doctor") {
    return (
      <div>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-display font-extrabold text-slate-800">
              My Queue
            </h1>
            <p className="text-sm text-slate-500">
              {greeting()}, Dr. {staff?.name?.split(" ")[0]} 👋
            </p>
          </div>
          {tenant?.status === "trialing" && trialDaysLeft !== null && (
            <Badge tone={trialDaysLeft <= 2 ? "alert" : "amber"}>
              {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in trial
            </Badge>
          )}
        </div>
        {data.myQueue.length === 0 ? (
          <EmptyState title="No patients waiting" sub="Your queue is clear." />
        ) : (
          <div className="space-y-2">
            {data.myQueue.map((v: any) => (
              <Link
                to={`/app/patients/${v.patient.id}`}
                key={v.id}
                className="bg-white rounded-xl border border-slate-100 p-4 flex justify-between items-center hover:border-blue-200 transition"
              >
                <div>
                  <div className="font-medium text-slate-800">
                    {v.patient.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    Started {new Date(v.startedAt).toLocaleTimeString()}
                  </div>
                </div>
                <Badge tone={v.status === "waiting" ? "amber" : "teal"}>
                  {v.status.replace("_", " ")}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  const mix = data.visitMix || {
    waiting: 0,
    inConsultation: 0,
    closedToday: 0,
  };
  const mixTotal = mix.waiting + mix.inConsultation + mix.closedToday;
  const mixData = [
    { name: "Waiting", value: mix.waiting },
    { name: "In Consultation", value: mix.inConsultation },
    { name: "Closed Today", value: mix.closedToday },
  ];

  const STATS = [
    {
      label: "Walk-ins Today",
      value: data.walkInsToday,
      icon: Users,
      tint: "bg-blue-50 text-blue-600",
    },
    {
      label: "Currently Waiting",
      value: data.patientsWaiting,
      icon: ClockIcon,
      tint: "bg-amber-50 text-amber-600",
    },
    {
      label: "Active Visits",
      value: data.activeVisits,
      icon: Activity,
      tint: "bg-purple-50 text-purple-600",
    },
    {
      label: "Today's Revenue",
      value: `₦${data.revenueToday.toLocaleString()}`,
      icon: Wallet,
      tint: "bg-orange-50 text-orange-600",
    },
    {
      label: "Staff on Duty",
      value: data.staffOnDuty,
      icon: UserCheck,
      tint: "bg-emerald-50 text-emerald-600",
    },
  ];

  const QUICK_ACTIONS = [
    {
      label: "Register Patient",
      to: "/app/patients/new",
      icon: UserPlus,
      roles: ["administrator", "receptionist"],
    },
    {
      label: "Start New Visit",
      to: "/app/visits",
      icon: ClipboardPlus,
      roles: ["administrator", "receptionist"],
    },
    {
      label: "Staff Attendance",
      to: "/app/attendance",
      icon: CalendarClock,
      roles: [
        "administrator",
        "doctor",
        "receptionist",
        "finance_officer",
        "nurse",
      ],
    },
    {
      label: "Send Message",
      to: "/app/communication",
      icon: MessageSquare,
      // communications.send_manual on the backend is administrator +
      // receptionist only — doctor can read the log but not send, so
      // doctor is deliberately left out here to match.
      roles: ["administrator", "receptionist"],
    },
    {
      label: "Record Expense",
      to: "/app/finance",
      icon: Receipt,
      roles: ["administrator", "finance_officer"],
    },
    {
      label: "View Patients",
      to: "/app/patients",
      icon: Users,
      roles: ["administrator", "doctor", "receptionist", "finance_officer"],
    },
  ].filter((a) => staff && a.roles.includes(staff.role));

  return (
    <div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-extrabold text-slate-800">
              Dashboard
            </h1>
            {tenant?.status === "trialing" && trialDaysLeft !== null && (
              <Badge tone={trialDaysLeft <= 2 ? "alert" : "amber"}>
                {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left in
                trial
              </Badge>
            )}
          </div>
          <p className="text-slate-600 mt-1">
            {greeting()}, {staff?.name?.split(" ")[0]} 👋
          </p>
          <p className="text-sm text-slate-400">
            Here's what's happening at {tenant?.hospitalName} today.
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
          <Link
            to="/app/visits"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
          >
            <Plus size={16} /> New Visit
          </Link>
        </div>
      </div>

      {/* Stat cards */}
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
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <h3 className="font-display font-bold text-slate-800 mb-3">
            Today's Visit Mix
          </h3>
          {mixTotal === 0 ? (
            <EmptyState title="No visits yet today" />
          ) : (
            <>
              <div className="h-40 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mixData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {mixData.map((_, i) => (
                        <Cell key={i} fill={MIX_COLORS[i]} />
                      ))}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-mono font-bold text-slate-800">
                    {mixTotal}
                  </div>
                  <div className="text-[11px] text-slate-400">Total Visits</div>
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                {mixData.map((m, i) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-2 text-slate-600">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: MIX_COLORS[i] }}
                      />
                      {m.name}
                    </span>
                    <span className="text-slate-400">
                      {m.value} (
                      {mixTotal ? Math.round((m.value / mixTotal) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <Link
            to="/app/visits"
            className="text-blue-600 text-sm font-medium flex items-center gap-1 mt-4 hover:gap-1.5 transition-all"
          >
            View all visits <ArrowRight size={14} />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-display font-bold text-slate-800">
              Today's Visits
            </h3>
            <Link
              to="/app/visits"
              className="text-blue-600 text-xs font-medium"
            >
              View Full Queue →
            </Link>
          </div>
          {(data.recentActivity || []).length === 0 ? (
            <EmptyState title="No visits yet today" />
          ) : (
            <div className="space-y-3">
              {data.recentActivity.slice(0, 5).map((v: any) => (
                <div
                  key={v.visitId}
                  className="flex items-center gap-3 text-sm"
                >
                  <div className="w-14 shrink-0 text-slate-400 text-xs font-mono">
                    {new Date(v.startedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-700 truncate">
                      {v.patient}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {v.doctor ? `Dr. ${v.doctor}` : "Unassigned"}
                      {v.department ? ` · ${v.department}` : ""}
                    </div>
                  </div>
                  <Badge
                    tone={
                      v.status === "closed"
                        ? "gray"
                        : v.status === "waiting"
                          ? "amber"
                          : "teal"
                    }
                  >
                    {v.status.replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-display font-bold text-slate-800">
              Recent Notifications
            </h3>
          </div>
          {notifications.length === 0 ? (
            <EmptyState title="Nothing new" />
          ) : (
            <div className="space-y-3">
              {notifications.map((n: any) => (
                <div key={n.key} className="flex items-start gap-3 text-sm">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${n.icon === "alert" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}
                  >
                    <Bell size={13} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-slate-700">{n.text}</div>
                    {n.time && (
                      <div className="text-xs text-slate-400">
                        {relativeTime(n.time)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {hasFinanceAccess && finance && (
          <div className="bg-white rounded-xl border border-slate-100 p-5 lg:col-span-2">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-display font-bold text-slate-800">
                Revenue Overview
              </h3>
              <Link
                to="/app/finance"
                className="text-blue-600 text-xs font-medium"
              >
                View full report →
              </Link>
            </div>
            <div className="text-2xl font-mono font-bold text-slate-800">
              ₦{finance.revenueThisMonth.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mb-2">This month</div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={finance.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                      })
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                    width={50}
                  />
                  <RTooltip
                    formatter={(v: any) => [
                      `₦${Number(v).toLocaleString()}`,
                      "Revenue",
                    ]}
                    labelFormatter={(d: any) =>
                      new Date(d).toLocaleDateString()
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {hasFinanceAccess && (
          <div className="bg-white rounded-xl border border-slate-100 p-5">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-display font-bold text-slate-800">
                Recent Expenses
              </h3>
              <Link
                to="/app/finance"
                className="text-blue-600 text-xs font-medium"
              >
                View all →
              </Link>
            </div>
            {expenses.length === 0 ? (
              <EmptyState title="No expenses recorded yet" />
            ) : (
              <div className="space-y-3">
                {expenses.map((e) => (
                  <div
                    key={e.id}
                    className="flex justify-between items-center text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-700 truncate">
                        {e.category}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {e.description}
                      </div>
                    </div>
                    <div className="font-mono text-slate-600 shrink-0 ml-2">
                      ₦{e.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          className={`bg-white rounded-xl border border-slate-100 p-5 ${hasFinanceAccess ? "" : "lg:col-span-3"}`}
        >
          <h3 className="font-display font-bold text-slate-800 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <Link
                key={a.label}
                to={a.to}
                className="flex flex-col items-center gap-2 text-center border border-slate-100 rounded-xl py-4 px-2 hover:border-blue-200 hover:bg-blue-50/40 transition"
              >
                <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <a.icon size={17} />
                </span>
                <span className="text-xs font-medium text-slate-600 leading-tight">
                  {a.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
