import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ui";

const ROLES = ["doctor", "receptionist", "finance_officer", "nurse"];

export default function SetupWizard() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [deptNames, setDeptNames] = useState(["General Reception"]);

  // If departments already exist (a previous attempt partly succeeded, or the
  // administrator left the wizard and came back), show them instead of the
  // blank default so "Continue" never tries to re-create what's there.
  useEffect(() => {
    api
      .get("/workforce/departments")
      .then((r) => {
        const existing: string[] = (r.departments || []).map(
          (d: any) => d.name,
        );
        if (existing.length > 0) setDeptNames(existing);
      })
      .catch(() => {});
  }, []);
  const [staffList, setStaffList] = useState<
    { name: string; role: string; email: string; phone: string }[]
  >([]);
  const [newStaff, setNewStaff] = useState({
    name: "",
    role: "doctor",
    email: "",
    phone: "",
  });

  async function saveDepartments() {
    // Trim + drop blanks + collapse case-insensitive duplicates before sending.
    const seen = new Set<string>();
    const names = deptNames
      .map((n) => n.trim())
      .filter((n) => {
        const k = n.toLowerCase();
        if (!n || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    if (names.length === 0) {
      setError("Add at least one department to continue");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/setup/departments", { names });
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function inviteStaff() {
    if (!newStaff.name) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/setup/invite-staff", newStaff);
      setStaffList((s) => [...s, newStaff]);
      setNewStaff({ name: "", role: "doctor", email: "", phone: "" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/setup/complete", {});
      await refresh();
      nav("/app/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="card w-full max-w-lg p-6 md:p-8">
        <h1 className="text-2xl font-extrabold text-teal-900">
          Set up your hospital
        </h1>
        <p className="text-sm text-teal-900/60 mt-1 mb-6">
          Step {step} of 3 — you can skip staff invites for now and add them
          later.
        </p>
        <ErrorBanner message={error} />

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Departments</p>
            {deptNames.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  value={d}
                  onChange={(e) =>
                    setDeptNames((arr) =>
                      arr.map((v, idx) => (idx === i ? e.target.value : v)),
                    )
                  }
                />
                {deptNames.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove department"
                    className="text-teal-900/40 hover:text-alert px-2 text-xl leading-none"
                    onClick={() =>
                      setDeptNames((arr) => arr.filter((_, idx) => idx !== i))
                    }
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn-secondary text-sm"
              onClick={() => setDeptNames((d) => [...d, ""])}
            >
              + Add another department
            </button>
            <button
              className="btn-primary w-full mt-3"
              disabled={loading}
              onClick={saveDepartments}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Invite staff (optional)</p>
            {staffList.map((s, i) => (
              <div key={i} className="text-sm bg-teal-50 rounded-lg px-3 py-2">
                {s.name} —{" "}
                <span className="capitalize">{s.role.replace("_", " ")}</span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Full name"
                value={newStaff.name}
                onChange={(e) =>
                  setNewStaff((s) => ({ ...s, name: e.target.value }))
                }
              />
              <select
                className="input"
                value={newStaff.role}
                onChange={(e) =>
                  setNewStaff((s) => ({ ...s, role: e.target.value }))
                }
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace("_", " ")}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Phone (for PIN via SMS)"
                value={newStaff.phone}
                onChange={(e) =>
                  setNewStaff((s) => ({ ...s, phone: e.target.value }))
                }
              />
              <input
                className="input"
                placeholder="Email (optional)"
                value={newStaff.email}
                onChange={(e) =>
                  setNewStaff((s) => ({ ...s, email: e.target.value }))
                }
              />
            </div>
            <button className="btn-secondary text-sm" onClick={inviteStaff}>
              + Add staff member
            </button>
            <div className="flex gap-2 mt-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button className="btn-primary flex-1" onClick={() => setStep(3)}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-center">
            <div className="text-4xl">🎉</div>
            <p className="text-sm text-teal-900/70">
              You're all set. You can always add more departments, staff, and
              settings later from the Admin panel.
            </p>
            <button
              className="btn-primary w-full"
              disabled={loading}
              onClick={finish}
            >
              {loading ? "Finishing…" : "Go to Dashboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
