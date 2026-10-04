import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, downloadFile } from "../../api/client";
import {
  Wallet,
  Users,
  UserCheck,
  Activity,
  Download,
  ArrowRight,
} from "lucide-react";

export default function ReportsPage() {
  const [finance, setFinance] = useState<any>(null);
  const [patients, setPatients] = useState<any>(null);
  const [queue, setQueue] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get("/finance/summary").catch(() => null),
      api.get("/patients/summary").catch(() => null),
      api.get("/visits/queue-insights").catch(() => null),
      api.get("/workforce/attendance/dashboard").catch(() => null),
    ])
      .then(([f, p, q, a]) => {
        setFinance(f);
        setPatients(p);
        setQueue(q);
        setAttendance(a);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-slate-800">
          Reports
        </h1>
        <p className="text-sm text-slate-500">
          Finance, patients, visits, and workforce — all in one place
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Overview strip — whatever the logged-in role has access to */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {finance && (
          <OverviewStat
            label="Revenue Today"
            value={`₦${finance.revenueToday.toLocaleString()}`}
            icon={Wallet}
            tint="bg-blue-50 text-blue-600"
          />
        )}
        {patients && (
          <OverviewStat
            label="Total Patients"
            value={patients.totalPatients.toLocaleString()}
            icon={Users}
            tint="bg-purple-50 text-purple-600"
          />
        )}
        {queue && (
          <OverviewStat
            label="Walk-ins Today"
            value={queue.totalWalkInsToday}
            icon={Activity}
            tint="bg-amber-50 text-amber-600"
          />
        )}
        {attendance && (
          <OverviewStat
            label="Staff On Duty"
            value={attendance.onDuty.length}
            icon={UserCheck}
            tint="bg-emerald-50 text-emerald-600"
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Finance report */}
        {finance && (
          <ReportCard
            title="Finance"
            icon={Wallet}
            tint="bg-blue-50 text-blue-600"
            viewAllTo="/app/finance"
            onExport={() =>
              downloadFile("/finance/export", "ihops-finance-export.xlsx")
            }
          >
            <Row
              label="Revenue this month"
              value={`₦${finance.revenueThisMonth.toLocaleString()}`}
            />
            <Row
              label="Outstanding payments"
              value={`₦${finance.outstandingPayments.toLocaleString()}`}
            />
            <Row
              label="Expenses this month"
              value={`₦${finance.expenses.toLocaleString()}`}
            />
            <Row
              label="Net cash position"
              value={`₦${finance.netCashPosition.toLocaleString()}`}
            />
          </ReportCard>
        )}

        {/* Patients report */}
        {patients && (
          <ReportCard
            title="Patients"
            icon={Users}
            tint="bg-purple-50 text-purple-600"
            viewAllTo="/app/patients"
            onExport={() =>
              downloadFile("/patients/export", "ihops-patients-export.xlsx")
            }
          >
            <Row label="New this month" value={patients.newThisMonth} />
            <Row label="Active" value={patients.activePatients} />
            <Row label="Returning" value={patients.returningPatients} />
            <Row
              label="Male : Female"
              value={`${patients.genderRatio.malePct}% : ${patients.genderRatio.femalePct}%`}
            />
          </ReportCard>
        )}

        {/* Visits & Queue report */}
        {queue && (
          <ReportCard
            title="Visits & Queue"
            icon={Activity}
            tint="bg-amber-50 text-amber-600"
            viewAllTo="/app/visits"
          >
            <Row
              label="Completed today"
              value={`${queue.completedToday} (${queue.completedPct}%)`}
            />
            <Row
              label="Average wait time"
              value={`${queue.avgWaitMinutes} mins`}
            />
            <Row
              label="Average consultation time"
              value={`${queue.avgConsultationMinutes} mins`}
            />
            <Row label="Peak hour" value={queue.peakHour || "—"} />
          </ReportCard>
        )}

        {/* Workforce / Attendance report */}
        {attendance && (
          <ReportCard
            title="Workforce & Attendance"
            icon={UserCheck}
            tint="bg-emerald-50 text-emerald-600"
            viewAllTo="/app/attendance"
            onExport={() =>
              downloadFile(
                "/workforce/attendance/export",
                "ihops-attendance-export.xlsx",
              )
            }
          >
            <Row label="On duty now" value={attendance.onDuty.length} />
            <Row label="Absent today" value={attendance.absent.length} />
            <Row
              label="Total hours today"
              value={attendance.totalHoursToday.toFixed(1)}
            />
          </ReportCard>
        )}
      </div>
    </div>
  );
}

function OverviewStat({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: any;
  icon: any;
  tint: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <span
        className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${tint}`}
      >
        <Icon size={18} />
      </span>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-mono font-semibold text-slate-800 mt-0.5">
        {value}
      </div>
    </div>
  );
}

function ReportCard({
  title,
  icon: Icon,
  tint,
  viewAllTo,
  onExport,
  children,
}: {
  title: string;
  icon: any;
  tint: string;
  viewAllTo: string;
  onExport?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}
          >
            <Icon size={18} />
          </span>
          <h3 className="font-display font-bold text-slate-800">{title}</h3>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="text-slate-400 hover:text-blue-600 flex items-center gap-1 text-xs font-medium"
          >
            <Download size={13} /> Export
          </button>
        )}
      </div>
      <div className="space-y-2 mb-4">{children}</div>
      <Link
        to={viewAllTo}
        className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:gap-1.5 transition-all"
      >
        View full report <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-700">{value}</span>
    </div>
  );
}
