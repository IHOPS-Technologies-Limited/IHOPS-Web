import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { ErrorBanner } from "../../components/ui";

const TARGET_FIELDS = ["name", "phone", "email", "gender", "dob", "address", "emergencyContact", "hospitalCardNumber", "preferredChannel"];

export default function ImportWizard() {
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function upload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/patients/import/preview", fd);
      setPreview(res);
      setMapping(res.suggestedMapping);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function commit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      const res = await api.post("/patients/import/commit", fd);
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="max-w-lg card p-6">
        <h1 className="text-xl font-extrabold text-teal-900 mb-3">Import complete</h1>
        <p className="text-sm">Imported: <strong>{result.imported}</strong></p>
        <p className="text-sm">Skipped: <strong>{result.skipped}</strong></p>
        <p className="text-sm">Flagged as possible duplicates: <strong>{result.flagged}</strong></p>
        {result.errorReport.length > 0 && (
          <div className="mt-3 text-xs text-alert max-h-40 overflow-y-auto">
            {result.errorReport.map((e: any, i: number) => <div key={i}>Row {e.row}: {e.issue}</div>)}
          </div>
        )}
        <button className="btn-primary mt-4 w-full" onClick={() => nav("/app/patients")}>Go to Patient Directory</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-extrabold text-teal-900 mb-6">Import patient list</h1>
      <ErrorBanner message={error} />

      {!preview ? (
        <div className="card p-6">
          <p className="text-sm text-teal-900/60 mb-3">Upload a .xlsx or .csv file with your existing patient records.</p>
          <input type="file" accept=".xlsx,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4" />
          <button className="btn-primary" disabled={!file || loading} onClick={upload}>{loading ? "Reading file…" : "Continue"}</button>
        </div>
      ) : (
        <div className="card p-6">
          <p className="text-sm text-teal-900/60 mb-3">{preview.totalRows} rows found. Confirm the column mapping below.</p>
          <div className="space-y-2 mb-4">
            {TARGET_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-3">
                <label className="w-40 text-sm capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
                <select className="input" value={mapping[field] || ""} onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}>
                  <option value="">— Not mapped —</option>
                  {preview.headers.map((h: string) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {preview.errors.length > 0 && (
            <div className="bg-amber-50 text-amber-800 text-xs rounded-lg p-3 mb-4">
              {preview.errors.length} row(s) have issues in the preview — these will be skipped and reported after import.
            </div>
          )}
          <button className="btn-primary w-full" disabled={loading} onClick={commit}>{loading ? "Importing…" : `Import ${preview.totalRows} patients`}</button>
        </div>
      )}
    </div>
  );
}
