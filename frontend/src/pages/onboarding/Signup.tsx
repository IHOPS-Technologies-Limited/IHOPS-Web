import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { ErrorBanner } from "../../components/ui";

const HOSPITAL_TYPES = [
  "General Hospital", "Private Clinic", "Teaching Hospital", "Dental Clinic",
  "Veterinary Clinic", "Eye Clinic", "Physiotherapy Clinic", "Diagnostic Centre", "Specialist Clinic",
];

const PLANS = [
  { code: "starter", name: "Starter", price: "₦15,000/mo", desc: "Up to 5 staff, core modules" },
  { code: "standard", name: "Standard", price: "₦35,000/mo", desc: "Unlimited staff, AI reminders, exports" },
  { code: "public_hospital", name: "Public Hospital", price: "Free (subject to approval)", desc: "For government-run facilities" },
];

export default function Signup() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    hospitalName: "", hospitalType: HOSPITAL_TYPES[0], contactPerson: "", email: "", phone: "",
    state: "", lga: "", address: "", nearestLandmark: "", adminName: "", adminPassword: "",
    planCode: "starter", billingCycle: "monthly",
  });

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/signup", form);
      nav("/check-email", { state: { email: form.email, publicHospitalRequested: res.publicHospitalRequested } });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="card w-full max-w-xl p-6 md:p-8">
        <h1 className="text-2xl font-extrabold text-teal-900">Register your hospital</h1>
        <p className="text-sm text-teal-900/60 mt-1 mb-6">Step {step} of 3</p>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="label">Hospital / Clinic name</label>
              <input className="input" value={form.hospitalName} onChange={(e) => update("hospitalName", e.target.value)} />
            </div>
            <div>
              <label className="label">Facility type</label>
              <select className="input" value={form.hospitalType} onChange={(e) => update("hospitalType", e.target.value)}>
                {HOSPITAL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Contact person</label><input className="input" value={form.contactPerson} onChange={(e) => update("contactPerson", e.target.value)} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
            </div>
            <div><label className="label">Hospital email</label><input type="email" className="input" value={form.email} onChange={(e) => update("email", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">State</label><input className="input" value={form.state} onChange={(e) => update("state", e.target.value)} /></div>
              <div><label className="label">LGA</label><input className="input" value={form.lga} onChange={(e) => update("lga", e.target.value)} /></div>
            </div>
            <div><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => update("address", e.target.value)} /></div>
            <div><label className="label">Nearest landmark (optional)</label><input className="input" value={form.nearestLandmark} onChange={(e) => update("nearestLandmark", e.target.value)} /></div>
            <button className="btn-primary w-full mt-2" onClick={() => setStep(2)}>Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-teal-900/80">Choose a plan</p>
            {PLANS.map((p) => (
              <label key={p.code} className={`block border rounded-lg p-3 cursor-pointer ${form.planCode === p.code ? "border-teal-600 bg-teal-50" : "border-teal-100"}`}>
                <input type="radio" name="plan" className="mr-2" checked={form.planCode === p.code} onChange={() => update("planCode", p.code)} />
                <span className="font-semibold">{p.name}</span> — <span className="text-teal-700">{p.price}</span>
                <div className="text-xs text-teal-900/60 ml-5">{p.desc}</div>
              </label>
            ))}
            {form.planCode !== "public_hospital" && (
              <div>
                <label className="label">Billing cycle</label>
                <select className="input" value={form.billingCycle} onChange={(e) => update("billingCycle", e.target.value)}>
                  <option value="monthly">Monthly</option>
                  <option value="annual">Annual (2 months free)</option>
                </select>
              </div>
            )}
            {form.planCode === "public_hospital" && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                Public Hospital accounts require IHOPS review after email verification. You'll be notified once approved.
              </p>
            )}
            <div className="flex gap-2 mt-2">
              <button className="btn-secondary flex-1" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary flex-1" onClick={() => setStep(3)}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-teal-900/80">Create your Administrator account</p>
            <div><label className="label">Your full name</label><input className="input" value={form.adminName} onChange={(e) => update("adminName", e.target.value)} /></div>
            <div><label className="label">Password</label><input type="password" className="input" value={form.adminPassword} onChange={(e) => update("adminPassword", e.target.value)} /></div>
            <ErrorBanner message={error} />
            <div className="flex gap-2 mt-2">
              <button className="btn-secondary flex-1" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary flex-1" disabled={loading} onClick={submit}>{loading ? "Creating account…" : "Create account"}</button>
            </div>
          </div>
        )}

        <p className="text-sm text-center text-teal-900/60 mt-6">
          Already registered? <Link to="/login" className="text-teal-700 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
