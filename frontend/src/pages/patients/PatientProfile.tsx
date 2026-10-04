import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import {
  PaymentBadge,
  Badge,
  EmptyState,
  Modal,
  ErrorBanner,
} from "../../components/ui";
import { useAuth } from "../../auth/AuthContext";
import { Pencil, ShieldAlert, Download, AlertTriangle } from "lucide-react";
// Added for Module 5 — the existing tabs' content below is unchanged, just
// reorganised under tab navigation so the new "Medical Record" tab could sit
// alongside it per the PRD's five-tab Patient Profile spec.
import MedicalRecordView from "../../components/clinical/MedicalRecordView";

const TABS = [
  "Overview",
  "Visits",
  "Medical Record",
  "Communication",
  "Payments",
] as const;
type Tab = (typeof TABS)[number];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

const STATUS_TONE: Record<string, "teal" | "gray" | "alert"> = {
  active: "teal",
  inactive: "gray",
  deceased: "alert",
};

export default function PatientProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { staff } = useAuth();
  const [patient, setPatient] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [showEdit, setShowEdit] = useState(false);
  const canStartVisit =
    staff && ["administrator", "receptionist"].includes(staff.role);
  const canEdit =
    staff && ["administrator", "receptionist"].includes(staff.role);
  const canViewMedicalRecord =
    staff && ["doctor", "nurse"].includes(staff.role);

  async function load() {
    const res = await api.get(`/patients/${id}`);
    setPatient(res.patient);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!patient) return <div className="text-teal-900/50">Loading…</div>;

  const visibleTabs = TABS.filter(
    (t) => t !== "Medical Record" || canViewMedicalRecord,
  );

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <span className="w-14 h-14 rounded-full bg-teal-100 text-teal-700 font-semibold flex items-center justify-center text-lg">
            {initials(patient.name)}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-teal-900">
                {patient.name}
              </h1>
              <Badge tone={STATUS_TONE[patient.status] || "gray"}>
                {patient.status}
              </Badge>
            </div>
            <p className="text-sm text-teal-900/50 font-mono">
              {patient.platformPatientId}
              {patient.hospitalCardNumber
                ? ` · Card ${patient.hospitalCardNumber}`
                : ""}
              {patient.bloodGroup ? ` · Blood Group ${patient.bloodGroup}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <button
              className="btn-secondary flex items-center gap-1.5"
              onClick={() => setShowEdit(true)}
            >
              <Pencil size={14} /> Edit
            </button>
          )}
          {canStartVisit && (
            <button
              className="btn-primary"
              onClick={() => nav(`/app/visits?startFor=${patient.id}`)}
            >
              Start visit
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-teal-100 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              tab === t
                ? "border-teal-600 text-teal-800"
                : "border-transparent text-teal-900/50 hover:text-teal-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-4 text-sm space-y-1">
              <div>
                <span className="text-teal-900/50">Phone:</span>{" "}
                {patient.phone || "—"}
              </div>
              <div>
                <span className="text-teal-900/50">Email:</span>{" "}
                {patient.email || "—"}
              </div>
              <div>
                <span className="text-teal-900/50">Gender:</span>{" "}
                {patient.gender}
              </div>
              <div>
                <span className="text-teal-900/50">DOB:</span>{" "}
                {new Date(patient.dob).toLocaleDateString()}
              </div>
              <div>
                <span className="text-teal-900/50">Address:</span>{" "}
                {patient.address}
              </div>
              <div>
                <span className="text-teal-900/50">Preferred channel:</span>{" "}
                <Badge>{patient.preferredChannel}</Badge>
              </div>
            </div>
            <div className="card p-4 text-sm space-y-1">
              <div>
                <span className="text-teal-900/50">Emergency contact:</span>{" "}
                {patient.emergencyContact || "—"}
              </div>
              {patient.guardianName && (
                <div>
                  <span className="text-teal-900/50">Guardian:</span>{" "}
                  {patient.guardianName} ({patient.guardianPhone})
                </div>
              )}
              {patient.species && (
                <div>
                  <span className="text-teal-900/50">Species:</span>{" "}
                  {patient.species}
                </div>
              )}
              <div>
                <span className="text-teal-900/50">Blood group:</span>{" "}
                {patient.bloodGroup || "Not recorded"}
              </div>
              {patient.administrativeNotes && (
                <div>
                  <span className="text-teal-900/50">Notes:</span>{" "}
                  {patient.administrativeNotes}
                </div>
              )}
            </div>
          </div>
          {canEdit && (
            <DataProtectionCard patient={patient} onAnonymized={load} />
          )}
        </div>
      )}

      {tab === "Visits" &&
        (patient.visits.length === 0 ? (
          <EmptyState title="No visits yet" />
        ) : (
          <div className="space-y-2">
            {patient.visits.map((v: any) => (
              <div
                key={v.id}
                className="card p-4 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">
                    {new Date(v.startedAt).toLocaleDateString()}{" "}
                    {v.doctor ? `· Dr. ${v.doctor.name}` : ""}
                  </div>
                  <div className="text-xs text-teal-900/50">
                    {v.treatmentNote || "No treatment note"}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <PaymentBadge status={v.payment?.status || null} />
                  <Badge tone={v.status === "closed" ? "gray" : "amber"}>
                    {v.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ))}

      {tab === "Medical Record" && canViewMedicalRecord && (
        <MedicalRecordView patientId={patient.id} />
      )}

      {tab === "Communication" &&
        (patient.communications.length === 0 ? (
          <EmptyState title="No messages sent yet" />
        ) : (
          <div className="space-y-2">
            {patient.communications.map((c: any) => (
              <div key={c.id} className="card p-3 text-sm">
                <div className="flex justify-between text-xs text-teal-900/50 mb-1">
                  <span className="capitalize">
                    {c.channel} · {c.trigger.replace("_", " ")}
                  </span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p>{c.messageBody}</p>
                <Badge tone={c.status === "failed" ? "alert" : "teal"}>
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        ))}

      {tab === "Payments" &&
        (patient.visits.filter((v: any) => v.payment).length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <div className="space-y-2">
            {patient.visits
              .filter((v: any) => v.payment)
              .map((v: any) => (
                <div
                  key={v.id}
                  className="card p-4 flex justify-between items-center text-sm"
                >
                  <span>{new Date(v.startedAt).toLocaleDateString()}</span>
                  <span className="font-mono">
                    {v.payment.amount
                      ? `₦${v.payment.amount.toLocaleString()}`
                      : "—"}
                  </span>
                  <PaymentBadge status={v.payment.status} />
                </div>
              ))}
          </div>
        ))}

      {showEdit && (
        <EditPatientModal
          patient={patient}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditPatientModal({
  patient,
  onClose,
  onSaved,
}: {
  patient: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: patient.name,
    phone: patient.phone || "",
    email: patient.email || "",
    address: patient.address,
    emergencyContact: patient.emergencyContact,
    bloodGroup: patient.bloodGroup || "",
    status: patient.status,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/patients/${patient.id}`, {
        ...form,
        bloodGroup: form.bloodGroup || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit patient">
      <ErrorBanner message={error} />
      <div className="space-y-3">
        <div>
          <label className="label">Full name</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input
            className="input"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Emergency contact</label>
          <input
            className="input"
            value={form.emergencyContact}
            onChange={(e) => set("emergencyContact", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Blood group</label>
            <select
              className="input"
              value={form.bloodGroup}
              onChange={(e) => set("bloodGroup", e.target.value)}
            >
              <option value="">— Not recorded —</option>
              {[
                "A+",
                "A-",
                "B+",
                "B-",
                "AB+",
                "AB-",
                "O+",
                "O-",
                "Unknown",
              ].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deceased">Deceased</option>
            </select>
          </div>
        </div>
        <button
          className="btn-primary w-full"
          disabled={loading}
          onClick={save}
        >
          {loading ? "Saving…" : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}

function DataProtectionCard({
  patient,
  onAnonymized,
}: {
  patient: any;
  onAnonymized: () => void;
}) {
  const [showAnonymize, setShowAnonymize] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      // A raw fetch rather than the shared api client, since this downloads
      // a file (the client's .get() expects a JSON body).
      const token = localStorage.getItem("ihops_token");
      const res = await fetch(`/api/patients/${patient.id}/data-export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ihops-patient-data-export-${patient.platformPatientId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="card p-4 text-sm">
      <div className="flex items-center gap-2 mb-2 text-teal-900/70 font-medium">
        <ShieldAlert size={15} /> Data protection
      </div>
      <p className="text-teal-900/50 text-xs mb-3">
        For subject access and erasure requests under the Nigeria Data
        Protection Act. Both actions are logged to the audit trail.
      </p>
      <div className="flex gap-2">
        <button
          className="btn-secondary text-xs flex items-center gap-1.5"
          disabled={exporting}
          onClick={exportData}
        >
          <Download size={13} />{" "}
          {exporting ? "Preparing…" : "Export patient data"}
        </button>
        <button
          className="text-xs text-alert border border-alert/30 rounded-lg px-3 py-2 hover:bg-red-50 flex items-center gap-1.5"
          onClick={() => setShowAnonymize(true)}
        >
          <AlertTriangle size={13} /> Anonymize
        </button>
      </div>
      {showAnonymize && (
        <AnonymizeModal
          patient={patient}
          onClose={() => setShowAnonymize(false)}
          onDone={() => {
            setShowAnonymize(false);
            onAnonymized();
          }}
        />
      )}
    </div>
  );
}

function AnonymizeModal({
  patient,
  onClose,
  onDone,
}: {
  patient: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/patients/${patient.id}/anonymize`, { reason });
      onDone();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Anonymize patient — irreversible">
      <ErrorBanner message={error} />
      <div className="space-y-3">
        <p className="text-sm text-teal-900/70">
          This permanently clears {patient.name}'s name, phone, email, address,
          and emergency/guardian contacts. Visit, payment, and clinical history
          stay on file (as most record-retention rules require) but will no
          longer be attributable to this person by name. This cannot be undone.
        </p>
        <div>
          <label className="label">
            Reason (required, for the audit trail)
          </label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Patient erasure request, ref #..."
          />
        </div>
        <div>
          <label className="label">Type the patient's name to confirm</label>
          <input
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={patient.name}
          />
        </div>
        <button
          className="w-full bg-alert text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50"
          disabled={
            loading || reason.trim().length < 3 || confirmText !== patient.name
          }
          onClick={submit}
        >
          {loading ? "Anonymizing…" : "Anonymize this patient"}
        </button>
      </div>
    </Modal>
  );
}
