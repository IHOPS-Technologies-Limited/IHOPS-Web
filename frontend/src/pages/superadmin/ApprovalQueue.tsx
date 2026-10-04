import React, { useEffect, useState } from "react";
import { superAdminApi } from "../../api/client";
import { Modal, ErrorBanner, EmptyState } from "../../components/ui";
import {
  darkInput,
  amberButton,
  ghostButton,
} from "../../components/superadmin/styles";
import {
  Building2,
  MapPin,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function ApprovalQueue() {
  const [applications, setApplications] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reviewed, setReviewed] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await superAdminApi.get("/internal/approvals");
    setApplications(res.applications);
  }
  useEffect(() => {
    load();
  }, []);

  async function approve() {
    setError(null);
    try {
      await superAdminApi.post(`/internal/approvals/${selected.id}/approve`, {
        reviewedDetails: reviewed,
      });
      setSelected(null);
      setReviewed(false);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function reject() {
    setError(null);
    try {
      await superAdminApi.post(`/internal/approvals/${selected.id}/reject`, {
        reason: rejectReason,
      });
      setSelected(null);
      setRejectReason("");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-white">
          Public Hospital Approval Queue
        </h1>
        <p className="text-sm text-slate-400">
          Applications from government-run facilities requesting free platform
          access
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-[#111827] border border-white/10 rounded-xl py-12 text-center text-slate-500">
          No pending applications
        </div>
      ) : (
        <div className="space-y-2">
          {applications.map((a) => (
            <div
              key={a.id}
              className="bg-[#111827] border border-white/10 rounded-xl p-4 flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </span>
                <div>
                  <div className="font-medium text-white">{a.hospitalName}</div>
                  <div className="text-xs text-slate-400">
                    {a.hospitalType} · {a.lga}, {a.state} · {a.contactPerson}
                  </div>
                </div>
              </div>
              <button className={amberButton} onClick={() => setSelected(a)}>
                Review
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={selected.hospitalName}
        >
          <ErrorBanner message={error} />
          <div className="text-sm space-y-2 mb-4 text-teal-900">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-teal-900/40" />{" "}
              {selected.hospitalType}
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-teal-900/40" />{" "}
              {selected.contactPerson} · {selected.phone}
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-teal-900/40" /> {selected.lga},{" "}
              {selected.state}
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-teal-900/40" /> Applied{" "}
              {new Date(selected.createdAt).toLocaleDateString()}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm mb-4">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I have reviewed the application details
          </label>
          <button
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg px-4 py-2.5 disabled:opacity-50 transition flex items-center justify-center gap-2 mb-4"
            disabled={!reviewed}
            onClick={approve}
          >
            <CheckCircle2 size={15} /> Approve
          </button>
          <div className="border-t pt-3">
            <label className="label">Rejection reason</label>
            <input
              className="input mb-2"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <button
              className="w-full text-alert border border-alert rounded-lg py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={!rejectReason}
              onClick={reject}
            >
              <XCircle size={15} /> Reject application
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
