import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Modal, ErrorBanner, Badge } from "../ui";
import DynamicList from "./DynamicList";

const SECTIONS = [
  "Complaint",
  "Vitals",
  "Diagnosis",
  "Allergies",
  "History",
  "Medication",
  "Prescription",
  "Investigations",
  "Imaging",
  "Treatment",
  "Follow-up",
];

// Rows a clinician added but never filled in (every field blank) are
// dropped before saving — they're not meaningful data, just UI scaffolding
// left over from clicking "+ Add" and changing their mind.
function dropEmptyRows(rows: any[]): any[] {
  return (rows || []).filter((row) =>
    Object.values(row).some((v) => String(v ?? "").trim() !== ""),
  );
}

export default function ClinicalNoteModal({
  visit,
  onClose,
  onSaved,
}: {
  visit: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [section, setSection] = useState("Complaint");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
  const [noteStatus, setNoteStatus] = useState<"draft" | "finalized" | null>(
    null,
  );

  const [form, setForm] = useState<any>({
    chiefComplaint: "",
    symptomsReported: "",
    complaintDuration: "",
    complaintNotes: "",
    temperature: "",
    bloodPressure: "",
    pulse: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weightKg: "",
    heightCm: "",
    diagnosisPrimary: "",
    diagnosisSecondary: "",
    diagnosisDifferential: "",
    diagnosisNotes: "",
    noKnownAllergies: false,
    allergies: [] as any[],
    medicalHistory: {
      illnesses: "",
      chronicConditions: "",
      surgeries: "",
      hospitalisations: "",
      familyHistory: "",
      socialHistory: "",
    },
    medicationHistoryCurrent: [] as any[],
    medicationHistoryPrevious: [] as any[],
    prescription: [] as any[],
    investigations: [] as any[],
    imaging: [] as any[],
    treatmentPlan: "",
    treatmentDuration: "",
    treatmentFrequency: "",
    treatmentRoute: "",
    treatmentTimeOfDay: "",
    treatmentInstructions: "",
    treatmentNotes: "",
    followUpRequired: false,
    followUpType: "Review",
    followUpExpectedTime: "Morning",
    followUpDurationOption: "One-time",
    approvedCommunicationInstruction: "",
  });

  useEffect(() => {
    api.get(`/clinical/visits/${visit.id}/notes`).then((res) => {
      if (res.note) {
        const n = res.note;
        setExistingNoteId(n.id);
        setNoteStatus(n.status);
        setForm((f: any) => ({
          ...f,
          ...n,
          allergies: n.allergies || [],
          medicalHistory: n.medicalHistory || f.medicalHistory,
          medicationHistoryCurrent: n.medicationHistory?.current || [],
          medicationHistoryPrevious: n.medicationHistory?.previous || [],
          prescription: n.prescription || [],
          investigations: n.investigations || [],
          imaging: n.imaging || [],
        }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(field: string, value: any) {
    setForm((f: any) => ({ ...f, [field]: value }));
  }
  function setHistory(field: string, value: string) {
    setForm((f: any) => ({
      ...f,
      medicalHistory: { ...f.medicalHistory, [field]: value },
    }));
  }

  function buildPayload(status: "draft" | "finalized") {
    // Only the fields the backend schema actually knows about are sent —
    // medicationHistoryCurrent/Previous are UI-only state, replaced below
    // by the shaped medicationHistory object the backend expects.
    const { medicationHistoryCurrent, medicationHistoryPrevious, ...rest } =
      form;
    return {
      ...rest,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      pulse: form.pulse ? Number(form.pulse) : undefined,
      respiratoryRate: form.respiratoryRate
        ? Number(form.respiratoryRate)
        : undefined,
      oxygenSaturation: form.oxygenSaturation
        ? Number(form.oxygenSaturation)
        : undefined,
      weightKg: form.weightKg ? Number(form.weightKg) : undefined,
      heightCm: form.heightCm ? Number(form.heightCm) : undefined,
      allergies: dropEmptyRows(form.allergies),
      prescription: dropEmptyRows(form.prescription),
      investigations: dropEmptyRows(form.investigations),
      imaging: dropEmptyRows(form.imaging),
      medicationHistory: {
        current: dropEmptyRows(form.medicationHistoryCurrent),
        previous: dropEmptyRows(form.medicationHistoryPrevious),
      },
      status,
    };
  }

  async function save(status: "draft" | "finalized") {
    setLoading(true);
    setError(null);
    try {
      const payload = buildPayload(status);
      if (existingNoteId) {
        await api.patch(`/clinical/notes/${existingNoteId}`, payload);
      } else {
        await api.post(`/clinical/visits/${visit.id}/notes`, payload);
      }
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
      title={`Clinical Note — ${visit.patient.name}`}
    >
      <ErrorBanner message={error} />
      {noteStatus && (
        <Badge tone={noteStatus === "finalized" ? "teal" : "amber"}>
          {noteStatus}
        </Badge>
      )}

      <div className="flex flex-wrap gap-1 my-3 border-b border-slate-100 pb-2">
        {SECTIONS.map((s) => (
          <button
            key={s}
            className={`text-xs px-2.5 py-1 rounded-full ${section === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            onClick={() => setSection(s)}
            type="button"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3">
        {section === "Complaint" && (
          <>
            <div>
              <label className="label">Chief complaint</label>
              <input
                className="input"
                value={form.chiefComplaint}
                onChange={(e) => set("chiefComplaint", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Symptoms reported</label>
              <input
                className="input"
                value={form.symptomsReported}
                onChange={(e) => set("symptomsReported", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Duration</label>
              <input
                className="input"
                value={form.complaintDuration}
                onChange={(e) => set("complaintDuration", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Additional comments</label>
              <textarea
                className="input"
                rows={2}
                value={form.complaintNotes}
                onChange={(e) => set("complaintNotes", e.target.value)}
              />
            </div>
          </>
        )}

        {section === "Vitals" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Temperature (°C)</label>
              <input
                className="input"
                value={form.temperature}
                onChange={(e) => set("temperature", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Blood pressure</label>
              <input
                className="input"
                placeholder="120/80"
                value={form.bloodPressure}
                onChange={(e) => set("bloodPressure", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Pulse (bpm)</label>
              <input
                className="input"
                value={form.pulse}
                onChange={(e) => set("pulse", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Respiratory rate</label>
              <input
                className="input"
                value={form.respiratoryRate}
                onChange={(e) => set("respiratoryRate", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Oxygen saturation (%)</label>
              <input
                className="input"
                value={form.oxygenSaturation}
                onChange={(e) => set("oxygenSaturation", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input
                className="input"
                value={form.weightKg}
                onChange={(e) => set("weightKg", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Height (cm)</label>
              <input
                className="input"
                value={form.heightCm}
                onChange={(e) => set("heightCm", e.target.value)}
              />
            </div>
          </div>
        )}

        {section === "Diagnosis" && (
          <>
            <div>
              <label className="label">Primary diagnosis</label>
              <input
                className="input"
                value={form.diagnosisPrimary}
                onChange={(e) => set("diagnosisPrimary", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Secondary diagnosis</label>
              <input
                className="input"
                value={form.diagnosisSecondary}
                onChange={(e) => set("diagnosisSecondary", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Differential diagnosis</label>
              <input
                className="input"
                value={form.diagnosisDifferential}
                onChange={(e) => set("diagnosisDifferential", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={2}
                value={form.diagnosisNotes}
                onChange={(e) => set("diagnosisNotes", e.target.value)}
              />
            </div>
          </>
        )}

        {section === "Allergies" && (
          <>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={form.noKnownAllergies}
                onChange={(e) => set("noKnownAllergies", e.target.checked)}
              />
              No Known Allergies (NKA)
            </label>
            {!form.noKnownAllergies && (
              <DynamicList
                items={form.allergies}
                onChange={(v) => set("allergies", v)}
                addLabel="Add allergy"
                fields={[
                  {
                    key: "type",
                    placeholder: "Type",
                    width: "w-32",
                    type: "select",
                    options: ["drug", "food", "environmental", "other"],
                  },
                  { key: "substance", placeholder: "Substance" },
                  { key: "reaction", placeholder: "Reaction" },
                  { key: "severity", placeholder: "Severity", width: "w-24" },
                ]}
              />
            )}
          </>
        )}

        {section === "History" && (
          <>
            <div>
              <label className="label">Previous illnesses</label>
              <input
                className="input"
                value={form.medicalHistory.illnesses}
                onChange={(e) => setHistory("illnesses", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Chronic conditions</label>
              <input
                className="input"
                value={form.medicalHistory.chronicConditions}
                onChange={(e) =>
                  setHistory("chronicConditions", e.target.value)
                }
              />
            </div>
            <div>
              <label className="label">Surgeries</label>
              <input
                className="input"
                value={form.medicalHistory.surgeries}
                onChange={(e) => setHistory("surgeries", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Hospitalisations</label>
              <input
                className="input"
                value={form.medicalHistory.hospitalisations}
                onChange={(e) => setHistory("hospitalisations", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Family history</label>
              <input
                className="input"
                value={form.medicalHistory.familyHistory}
                onChange={(e) => setHistory("familyHistory", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Social history</label>
              <input
                className="input"
                value={form.medicalHistory.socialHistory}
                onChange={(e) => setHistory("socialHistory", e.target.value)}
              />
            </div>
          </>
        )}

        {section === "Medication" && (
          <>
            <p className="text-xs font-medium text-slate-500 mb-1">
              Current medication
            </p>
            <DynamicList
              items={form.medicationHistoryCurrent}
              onChange={(v) => set("medicationHistoryCurrent", v)}
              addLabel="Add current medication"
              fields={[
                { key: "name", placeholder: "Medication name" },
                { key: "strength", placeholder: "Strength", width: "w-24" },
                { key: "dosage", placeholder: "Dosage", width: "w-24" },
                { key: "frequency", placeholder: "Frequency", width: "w-28" },
              ]}
            />
            <p className="text-xs font-medium text-slate-500 mb-1 mt-3">
              Previous medication
            </p>
            <DynamicList
              items={form.medicationHistoryPrevious}
              onChange={(v) => set("medicationHistoryPrevious", v)}
              addLabel="Add previous medication"
              fields={[
                { key: "name", placeholder: "Medication name" },
                { key: "notes", placeholder: "Notes" },
              ]}
            />
          </>
        )}

        {section === "Prescription" && (
          <DynamicList
            items={form.prescription}
            onChange={(v) => set("prescription", v)}
            addLabel="Add prescription line"
            fields={[
              { key: "medication", placeholder: "Medication" },
              { key: "strength", placeholder: "Strength", width: "w-20" },
              { key: "dosage", placeholder: "Dosage", width: "w-24" },
              { key: "frequency", placeholder: "Frequency", width: "w-28" },
              { key: "duration", placeholder: "Duration", width: "w-24" },
              { key: "instructions", placeholder: "Instructions" },
            ]}
          />
        )}

        {section === "Investigations" && (
          <DynamicList
            items={form.investigations}
            onChange={(v) => set("investigations", v)}
            addLabel="Add investigation"
            fields={[
              { key: "testRequested", placeholder: "Test requested" },
              { key: "reason", placeholder: "Reason" },
              { key: "status", placeholder: "Status", width: "w-32" },
              { key: "resultSummary", placeholder: "Result summary" },
            ]}
          />
        )}

        {section === "Imaging" && (
          <DynamicList
            items={form.imaging}
            onChange={(v) => set("imaging", v)}
            addLabel="Add imaging record"
            fields={[
              {
                key: "imagingType",
                placeholder: "Type (X-Ray/US/CT/MRI)",
                width: "w-40",
              },
              { key: "findings", placeholder: "Findings" },
              { key: "impression", placeholder: "Impression" },
            ]}
          />
        )}

        {section === "Treatment" && (
          <>
            <div>
              <label className="label">Treatment / care plan</label>
              <textarea
                className="input"
                rows={2}
                value={form.treatmentPlan}
                onChange={(e) => set("treatmentPlan", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Duration</label>
                <input
                  className="input"
                  value={form.treatmentDuration}
                  onChange={(e) => set("treatmentDuration", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Frequency</label>
                <input
                  className="input"
                  value={form.treatmentFrequency}
                  onChange={(e) => set("treatmentFrequency", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Route</label>
                <input
                  className="input"
                  value={form.treatmentRoute}
                  onChange={(e) => set("treatmentRoute", e.target.value)}
                />
              </div>
              <div>
                <label className="label">Time of day</label>
                <select
                  className="input"
                  value={form.treatmentTimeOfDay}
                  onChange={(e) => set("treatmentTimeOfDay", e.target.value)}
                >
                  <option value="">—</option>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Evening</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Instructions</label>
              <textarea
                className="input"
                rows={2}
                value={form.treatmentInstructions}
                onChange={(e) => set("treatmentInstructions", e.target.value)}
              />
            </div>
          </>
        )}

        {section === "Follow-up" && (
          <>
            <label className="flex items-center gap-2 text-sm mb-2">
              <input
                type="checkbox"
                checked={form.followUpRequired}
                onChange={(e) => set("followUpRequired", e.target.checked)}
              />
              Follow-up required
            </label>
            {form.followUpRequired && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Follow-up type</label>
                    <select
                      className="input"
                      value={form.followUpType}
                      onChange={(e) => set("followUpType", e.target.value)}
                    >
                      {[
                        "Treatment",
                        "Review",
                        "Injection",
                        "Dressing",
                        "Vaccination",
                        "Deworming",
                        "Medication",
                        "Consultation",
                        "Procedure",
                        "Other",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Expected time</label>
                    <select
                      className="input"
                      value={form.followUpExpectedTime}
                      onChange={(e) =>
                        set("followUpExpectedTime", e.target.value)
                      }
                    >
                      <option>Morning</option>
                      <option>Afternoon</option>
                      <option>Evening</option>
                      <option>Fixed Time</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">
                    Approved Communication Instruction
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder='e.g. "Please remind the patient to return tomorrow morning for the second day of treatment."'
                    value={form.approvedCommunicationInstruction}
                    onChange={(e) =>
                      set("approvedCommunicationInstruction", e.target.value)
                    }
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    This is the only text the Restricted AI Communication Engine
                    will ever see — it never has access to the diagnosis,
                    allergies, or prescription above.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
        <button
          className="flex-1 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg px-4 py-2.5 hover:bg-slate-50 disabled:opacity-50"
          disabled={loading}
          onClick={() => save("draft")}
        >
          Save draft
        </button>
        <button
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 disabled:opacity-50"
          disabled={loading}
          onClick={() => save("finalized")}
        >
          {loading ? "Saving…" : "Finalize note"}
        </button>
      </div>
    </Modal>
  );
}
