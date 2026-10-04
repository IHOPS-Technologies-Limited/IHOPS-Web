import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ui";

export default function ChangePin() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    if (newPin !== confirmPin) return setError("PINs do not match");
    if (!/^\d{4,6}$/.test(newPin)) return setError("PIN must be 4-6 digits");
    setLoading(true);
    try {
      await api.post("/auth/change-pin", { newPin });
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
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-extrabold text-teal-900 mb-1">Set a new PIN</h1>
        <p className="text-sm text-teal-900/60 mb-6">For security, choose a personal 4–6 digit PIN to replace your temporary one.</p>
        <ErrorBanner message={error} />
        <div className="space-y-3">
          <div><label className="label">New PIN</label><input type="password" inputMode="numeric" className="input" value={newPin} onChange={(e) => setNewPin(e.target.value)} /></div>
          <div><label className="label">Confirm PIN</label><input type="password" inputMode="numeric" className="input" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} /></div>
          <button className="btn-primary w-full" disabled={loading} onClick={submit}>{loading ? "Saving…" : "Save PIN"}</button>
        </div>
      </div>
    </div>
  );
}
