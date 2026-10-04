import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { ErrorBanner } from "../../components/ui";
import { Building2, Plus } from "lucide-react";

export default function Settings() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDept, setNewDept] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get("/workforce/departments");
    setDepartments(res.departments);
  }
  useEffect(() => {
    load();
  }, []);

  async function addDept() {
    if (!newDept) return;
    setError(null);
    try {
      await api.post("/auth/setup/departments", { names: [newDept] });
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
    </div>
  );
}
