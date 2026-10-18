import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ErrorBanner } from "../../components/ui";
import { Building2, Plus, KeyRound } from "lucide-react";

export default function Settings() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDept, setNewDept] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pwBusy, setPwBusy] = useState(false);

  async function changePassword() {
    setPwMsg(null);
    if (pw.next.length < 8)
      return setPwMsg({
        ok: false,
        text: "New password must be at least 8 characters",
      });
    if (pw.next !== pw.confirm)
      return setPwMsg({ ok: false, text: "The two new passwords don't match" });
    setPwBusy(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password updated" });
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.data?.error || e.message });
    } finally {
      setPwBusy(false);
    }
  }

  async function load() {
    const res = await api.get("/workforce/departments");
    setDepartments(res.departments);
  }
  useEffect(() => {
    load();
  }, []);

  async function addDept() {
    if (!newDept.trim()) return;
    setError(null);
    setInfo(null);
    try {
      const res = await api.post("/auth/setup/departments", {
        names: [newDept],
      });
      if (res.created.length === 0)
        setInfo(`“${newDept.trim()}” already exists — nothing was added.`);
      setNewDept("");
      load();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-extrabold text-slate-800">
          Hospital Settings
        </h1>
        <p className="text-sm text-slate-500">
          Departments and hospital-wide defaults
        </p>
      </div>
      <ErrorBanner message={error} />
      {info && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2 mb-4">
          {info}
        </div>
      )}

      <h2 className="font-display font-bold text-slate-800 mb-3 flex items-center gap-2">
        <Building2 size={16} /> Departments
      </h2>
      <div className="bg-white rounded-xl border border-slate-100 p-4 mb-3">
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <span key={d.id} className="badge bg-blue-50 text-blue-700">
              {d.name}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="New department name"
          value={newDept}
          onChange={(e) => setNewDept(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDept()}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 flex items-center gap-1.5 shrink-0"
          onClick={addDept}
        >
          <Plus size={15} /> Add
        </button>
      </div>

      <h2 className="font-display font-bold text-slate-800 mt-10 mb-3 flex items-center gap-2">
        <KeyRound size={16} /> Change password
      </h2>
      <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
        {pwMsg && (
          <div
            className={`text-sm rounded-lg px-3 py-2 border ${
              pwMsg.ok
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-alert"
            }`}
          >
            {pwMsg.text}
          </div>
        )}
        <input
          type="password"
          className="input"
          placeholder="Current password"
          autoComplete="current-password"
          value={pw.current}
          onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
        />
        <input
          type="password"
          className="input"
          placeholder="New password (at least 8 characters)"
          autoComplete="new-password"
          value={pw.next}
          onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
        />
        <input
          type="password"
          className="input"
          placeholder="Confirm new password"
          autoComplete="new-password"
          value={pw.confirm}
          onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
          onKeyDown={(e) => e.key === "Enter" && changePassword()}
        />
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50"
          disabled={pwBusy || !pw.current || !pw.next}
          onClick={changePassword}
        >
          {pwBusy ? "Updating…" : "Update password"}
        </button>
        <p className="text-xs text-slate-400">
          Forgot your current password? Sign out and use “Forgot password?” on
          the sign-in page.
        </p>
      </div>
    </div>
  );
}
