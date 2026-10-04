import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { EmptyState, Badge } from "../ui";

export default function MedicalRecordView({
  patientId,
}: {
  patientId: string;
}) {
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(`/clinical/patients/${patientId}/medical-record`)
      .then(setRecord)
      .catch((e) => setError(e.data?.error || e.message));
  }, [patientId]);

  if (error) {
    return (
      <div className="text-sm text-slate-500 bg-blue-50 rounded-lg p-4">
        {error === "FORBIDDEN"
          ? "Your role does not have clinical record access."
          : error}
      </div>
    );
  }
  if (!record)
    return (
      <div className="text-slate-500 text-sm">Loading medical record…</div>
    );

  const cs = record.clinicalSummary;

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl border border-slate-100 p-4">
        <h3 className="font-display font-bold text-slate-800 mb-3">
          Clinical Summary
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-slate-500">Allergies: </span>
            {cs.allergies === "NKA — No Known Allergies" ? (
              <Badge tone="teal">NKA</Badge>
            ) : Array.isArray(cs.allergies) && cs.allergies.length ? (
              cs.allergies.map((a: any, i: number) => (
                <Badge key={i} tone="alert">
                  {a.substance}
                </Badge>
              ))
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-slate-500">Most recent diagnosis: </span>
            {cs.mostRecentDiagnosis || "—"}
          </div>
          <div>
            <span className="text-slate-500">Active treatment: </span>
            {cs.activeTreatment || "—"}
          </div>
          <div>
            <span className="text-slate-500">Upcoming follow-up: </span>
            {cs.upcomingFollowUp
              ? `${cs.upcomingFollowUp.type} — ${cs.upcomingFollowUp.date ? new Date(cs.upcomingFollowUp.date).toLocaleDateString() : "date TBD"}`
              : "—"}
          </div>
        </div>
      </div>

      <div>
        <h3 className="font-display font-bold text-slate-800 mb-3">
          Clinical Visit Timeline
        </h3>
        {record.timeline.length === 0 ? (
          <EmptyState title="No finalized Clinical Notes yet" />
        ) : (
          <div className="space-y-2">
            {record.timeline
              .slice()
              .reverse()
              .map((t: any, i: number) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-100 p-4 text-sm"
                >
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>
                      {t.date ? new Date(t.date).toLocaleDateString() : "—"}
                    </span>
                    {t.followUp && (
                      <Badge tone="amber">Follow-up: {t.followUp}</Badge>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Complaint:</span>{" "}
                    {t.complaint || "—"}
                  </div>
                  <div>
                    <span className="text-slate-500">Diagnosis:</span>{" "}
                    {t.diagnosis || "—"}
                  </div>
                  <div>
                    <span className="text-slate-500">Treatment:</span>{" "}
                    {t.treatment || "—"}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {record.documents.length > 0 && (
        <div>
          <h3 className="font-display font-bold text-slate-800 mb-3">
            Documents
          </h3>
          <div className="flex flex-wrap gap-2">
            {record.documents.map((d: any) => (
              <a
                key={d.id}
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="badge bg-blue-50 text-blue-700"
              >
                {d.fileName}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
