import React, { useEffect, useState } from "react";
import { api, downloadFile } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner, EmptyState } from "../../components/ui";
import {
  LogIn,
  LogOut,
  Users,
  UserCheck,
  UserX,
  Clock3,
  Download,
} from "lucide-react";

export default function Attendance() {
  const { staff } = useAuth();
  const canManage = staff && staff.role === "administrator";
  return (
    <div className="space-y-8">
      <Kiosk />
      {canManage && <AttendanceDashboard />}
    </div>
  );
}

function Kiosk() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkIn() {
    setError(null);
    try {
      await api.post("/workforce/attendance/check-in", {});
      setMessage("Checked in. Have a great shift!");
    } catch (e: any) {
      setError(e.data?.error || e.message);
    }
  }
  async function checkOut() {
    setError(null);
    try {
      const res = await api.post("/workforce/attendance/check-out", {});
      setMessage(
        `Checked out. Hours worked: ${res.attendance.hoursWorked.toFixed(2)}`,
      );
    } catch (e: any) {
      setError(e.data?.error || e.message);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-display font-extrabold text-slate-800">
          Attendance Kiosk
        </h1>
        <p className="text-sm text-slate-500">
          Check in and out for your shift
        </p>
      </div>
      <ErrorBanner message={error} />
      {message && (
        <div className="bg-emerald-50 text-emerald-700 text-sm rounded-lg px-3 py-2 mb-4">
          {message}
        </div>
      )}
      <div className="flex gap-3">
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
          onClick={checkIn}
        >
          <LogIn size={15} /> Check in
        </button>
        <button
          className="bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition"
          onClick={checkOut}
        >
          <LogOut size={15} /> Check out
        </button>
      </div>
    </div>
  );
}

function AttendanceDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get("/workforce/attendance/dashboard").then(setData);
  }, []);

  if (!data) return null;

  const STATS = [
    {
      label: "On Duty",
      value: data.onDuty.length,
      icon: Users,
      tint: "bg-blue-50 text-blue-600",
    },
    {
      label: "Checked Out",
      value: data.checkedOut.length,
      icon: UserCheck,
      tint: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Absent Today",
      value: data.absent.length,
      icon: UserX,
      tint: "bg-red-50 text-red-500",
    },
    {
      label: "Total Hours Today",
      value: data.totalHoursToday.toFixed(1),
      icon: Clock3,
      tint: "bg-purple-50 text-purple-600",
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-display font-extrabold text-slate-800">
          Attendance overview
        </h2>
        <button
          className="bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition"
          onClick={() =>
            downloadFile(
              "/workforce/attendance/export",
              "ihops-attendance-export.xlsx",
            )
          }
        >
          <Download size={15} /> Export
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
            <div className="text-lg font-mono font-semibold text-slate-800 mt-0.5">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {data.absent.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-slate-500 mb-2 text-sm">
            Absent today
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.absent.map((a: any, i: number) => (
              <span key={i} className="badge bg-red-50 text-red-500">
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <h3 className="font-medium text-slate-500 mb-2 text-sm">Last 7 days</h3>
      {data.weeklyGrid.length === 0 ? (
        <EmptyState title="No attendance records yet" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Hours</th>
              </tr>
            </thead>
            <tbody>
              {data.weeklyGrid.map((r: any, i: number) => (
                <tr
                  key={i}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 text-slate-700">{r.staff}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">
                    {r.hoursWorked ? r.hoursWorked.toFixed(2) : "—"}
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
