import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Badge, Modal, ErrorBanner } from "../../components/ui";
import { UserPlus, KeyRound, UserX, Building2 } from "lucide-react";

const ROLES = [
  "doctor",
  "receptionist",
  "finance_officer",
  "nurse",
  "administrator",
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function StaffDirectory() {
  const [staff, setStaff] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDeptFor, setEditingDeptFor] = useState<any>(null);

  async function load() {
    const res = await api.get("/workforce/staff");
    setStaff(res.staff);
  }
  useEffect(() => {
    load();
    api
      .get("/workforce/departments")
      .then((r) => setDepartments(r.departments));
  }, []);

  async function resetPin(id: string) {
    await api.post(`/workforce/staff/${id}/reset-pin`, {});
    alert("PIN reset — new temporary PIN has been sent to the staff member.");
  }
  async function deactivate(id: string) {
    if (
      !confirm(
        "Deactivate this staff member? They will no longer be able to sign in.",
      )
    )
      return;
    await api.del(`/workforce/staff/${id}`);
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-slate-800">
            Staff Directory
          </h1>
          <p className="text-sm text-slate-500">
            Manage staff accounts, PINs, departments, and roles
          </p>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 flex items-center gap-2 transition"
          onClick={() => setShowAdd(true)}
        >
          <UserPlus size={15} /> Add staff
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3 font-medium">Staff</th>
              <th className="px-4 py-3 font-medium">Staff ID</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr
                key={s.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                      {initials(s.name)}
                    </span>
                    <span className="font-medium text-slate-700">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                  {s.staffIdDisplay}
                </td>
                <td className="px-4 py-3 text-slate-500">{s.email || "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {s.department || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 capitalize">
                  {s.role.replace("_", " ")}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={s.status === "active" ? "teal" : "gray"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      onClick={() => setEditingDeptFor(s)}
                    >
                      <Building2 size={12} /> Department
                    </button>
                    <button
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      onClick={() => resetPin(s.id)}
                    >
                      <KeyRound size={12} /> Reset PIN
                    </button>
                    {s.status === "active" && (
                      <button
                        className="text-xs text-red-500 hover:underline flex items-center gap-1"
                        onClick={() => deactivate(s.id)}
                      >
                        <UserX size={12} /> Deactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddStaffModal
          departments={departments}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
      {editingDeptFor && (
        <ChangeDepartmentModal
          staff={editingDeptFor}
          departments={departments}
          onClose={() => setEditingDeptFor(null)}
          onSaved={() => {
            setEditingDeptFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddStaffModal({
  departments,
  onClose,
  onSaved,
}: {
  departments: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("receptionist");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await api.post("/workforce/staff", {
        name,
        role,
        email,
        phone,
        departmentId: departmentId || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add staff member">
      <ErrorBanner message={error} />
      <div className="space-y-3">
        <div>
          <label className="label">Full name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Department (optional)</label>
          <select
            className="input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">— Not assigned —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Phone (for PIN delivery via SMS)</label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Email (optional)</label>
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full disabled:opacity-50"
          disabled={loading}
          onClick={submit}
        >
          {loading ? "Saving…" : "Add staff member"}
        </button>
      </div>
    </Modal>
  );
}

function ChangeDepartmentModal({
  staff,
  departments,
  onClose,
  onSaved,
}: {
  staff: any;
  departments: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [departmentId, setDepartmentId] = useState(staff.departmentId || "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await api.patch(`/workforce/staff/${staff.id}/department`, {
        departmentId: departmentId || undefined,
      });
      onSaved();
    } catch (e: any) {
      setError(e.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Department — ${staff.name}`}>
      <ErrorBanner message={error} />
      <div className="space-y-3">
        <div>
          <label className="label">Department</label>
          <select
            className="input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">— Not assigned —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 w-full disabled:opacity-50"
          disabled={loading}
          onClick={submit}
        >
          {loading ? "Saving…" : "Save department"}
        </button>
      </div>
    </Modal>
  );
}
