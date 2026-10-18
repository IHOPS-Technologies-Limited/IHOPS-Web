import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { superAdminApi } from "../../api/client";
import { darkInput } from "../../components/superadmin/styles";
import {
  PageHeader,
  DarkBadge,
  NoticeBar,
  Notice,
  errText,
  fmtDate,
  fmtNaira,
  titleCase,
} from "../../components/superadmin/ui";

export default function Payments() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    setLoading(true);
    superAdminApi
      .get(`/internal/payments?status=${status}`)
      .then((r) => {
        setRows(r.payments);
        setNotice(null);
      })
      .catch((e) => setNotice({ kind: "error", text: errText(e) }))
      .finally(() => setLoading(false));
  }, [status]);

  const total = rows.filter((r) => r.status === "success").reduce((a, r) => a + r.amount, 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        sub="Subscription payments across all hospitals (SMS top-ups are in each hospital's wallet)"
        actions={
          <select className={`${darkInput} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All</option>
            <option value="success">Successful</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        }
      />
      <NoticeBar notice={notice} />
      {loading ? (
        <div className="text-slate-500 text-sm py-12 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-[#111827] border border-white/10 rounded-xl py-12 text-center text-slate-500">
          No payments yet
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-400 mb-3">
            Showing {rows.length} payment{rows.length === 1 ? "" : "s"} · successful total{" "}
            <span className="text-white font-mono">{fmtNaira(total)}</span>
          </p>
          <div className="bg-[#111827] border border-white/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm text-slate-200">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/10">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Hospital</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">{fmtDate(p.paidAt)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/internal/hospitals/${p.tenantId}`} className="text-amber-400 hover:text-amber-300">
                        {p.hospital}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-300">{titleCase(p.plan)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtNaira(p.amount)}</td>
                    <td className="px-4 py-3">
                      <DarkBadge tone={p.status === "success" ? "green" : p.status === "failed" ? "red" : "amber"}>{p.status}</DarkBadge>
                      {p.manual && <span className="ml-1"><DarkBadge>manual</DarkBadge></span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono break-all max-w-[260px]">{p.reference || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
