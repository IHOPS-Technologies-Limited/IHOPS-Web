import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Modal, ErrorBanner } from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";

export default function ClinicalUpdateModal({
  visit,
  onClose,
  onSaved,
}: {
  visit: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { staff } = useAuth();
  const [doctorId, setDoctorId] = useState(visit.doctorId || "");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [treatmentNote, setTreatmentNote] = useState(visit.treatmentNote || "");
  const [followUpType, setFollowUpType] = useState(
    visit.followUpType || "none",
  );
  const [followUpInDays, setFollowUpInDays] = useState(
    visit.followUpInDays || 3,
  );
  const [recurringEveryDays, setRecurringEveryDays] = useState(
    visit.recurringEveryDays || 7,
  );
  const [recurringCount, setRecurringCount] = useState(
    visit.recurringCount || 3,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const url = visit.departmentId
      ? `/workforce/doctors?departmentId=${visit.departmentId}`
      : "/workforce/doctors";
    api
      .get(url)
      .then((r) => setDoctors(r.doctors))
      .catch(() => {});
  }, [visit.departmentId]);

  async function save() {
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/visits/${visit.id}/clinical`, {
        doctorId: doctorId || undefined,
        treatmentNote,
        followUpType,
        followUpInDays:
          followUpType === "return_in_days" ? Number(followUpInDays) : null,
        recurringEveryDays:
          followUpType === "recurring" ? Number(recurringEveryDays) : null,
        recurringCount:
          followUpType === "recurring" ? Number(recurringCount) : null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Update visit — ${visit.patient.name}`}
    >
      <ErrorBanner message={error} />
      <div className="space-y-3">
        <div>
          <label className="label">
            Doctor{visit.department ? ` (${visit.department.name})` : ""}
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
          {visit.departmentId && doctors.length === 0 && (
            <p className="text-xs text-slate-400 mt-1">
              No doctors are assigned to this department yet.
            </p>
          )}
          {staff?.role === "doctor" && !doctorId && (
            <button
              type="button"
              className="text-xs text-teal-700 mt-1 hover:underline"
              onClick={() => setDoctorId(staff.id)}
            >
              Assign to me
            </button>
          )}
        </div>
        <div>
          <label className="label">Treatment note</label>
          <textarea
            className="input"
            rows={3}
            value={treatmentNote}
            onChange={(e) => setTreatmentNote(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Follow-up</label>
          <select
            className="input"
            value={followUpType}
            onChange={(e) => setFollowUpType(e.target.value)}
          >
            <option value="none">None</option>
            <option value="return_in_days">Return in X days</option>
            <option value="recurring">Recurring visits</option>
          </select>
        </div>
        {followUpType === "return_in_days" && (
          <div>
            <label className="label">Days until return</label>
            <input
              type="number"
              className="input"
              value={followUpInDays}
              onChange={(e) => setFollowUpInDays(Number(e.target.value))}
            />
          </div>
        )}
        {followUpType === "recurring" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Every X days</label>
              <input
                type="number"
                className="input"
                value={recurringEveryDays}
                onChange={(e) => setRecurringEveryDays(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Total occurrences</label>
              <input
                type="number"
                className="input"
                value={recurringCount}
                onChange={(e) => setRecurringCount(Number(e.target.value))}
              />
            </div>
          </div>
        )}
        <button
          className="btn-primary w-full"
          disabled={loading}
          onClick={save}
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
