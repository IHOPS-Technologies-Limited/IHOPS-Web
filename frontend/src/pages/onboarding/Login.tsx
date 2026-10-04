import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ErrorBanner } from "../../components/ui";

export default function Login() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [tenantEmail, setTenantEmail] = useState("");
  const [staffIdDisplay, setStaffIdDisplay] = useState("");
  const [pin, setPin] = useState("");

  async function submitPassword() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/login", { email, password });
      setSession(res.token, res.staff, res.tenant);
      nav("/app/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitPin() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/auth/pin-login", {
        tenantEmail,
        staffIdDisplay,
        pin,
      });
      setSession(res.token, res.staff);
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
        <h1 className="text-2xl font-extrabold text-teal-900 mb-1">IHOPS</h1>
        <p className="text-sm text-teal-900/60 mb-6">
          Sign in to your hospital workspace
        </p>

        <div className="flex mb-5 bg-teal-50 rounded-lg p-1 text-sm font-medium">
          <button
            className={`flex-1 py-1.5 rounded-md ${mode === "password" ? "bg-white shadow-sm text-teal-800" : "text-teal-900/50"}`}
            onClick={() => setMode("password")}
          >
            Administrator
          </button>
          <button
            className={`flex-1 py-1.5 rounded-md ${mode === "pin" ? "bg-white shadow-sm text-teal-800" : "text-teal-900/50"}`}
            onClick={() => setMode("pin")}
          >
            Staff PIN
          </button>
        </div>

        <ErrorBanner message={error} />

        {mode === "password" ? (
          <div className="space-y-3">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPassword()}
              />
            </div>
            <button
              className="btn-primary w-full"
              disabled={loading}
              onClick={submitPassword}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="label">Hospital email</label>
              <input
                type="email"
                className="input"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Staff ID</label>
              <input
                className="input"
                placeholder="IHOPS-0002"
                value={staffIdDisplay}
                onChange={(e) => setStaffIdDisplay(e.target.value)}
              />
            </div>
            <div>
              <label className="label">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                className="input tracking-widest"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPin()}
              />
            </div>
            <button
              className="btn-primary w-full"
              disabled={loading}
              onClick={submitPin}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        )}

        <p className="text-sm text-center text-teal-900/60 mt-6">
          New hospital?{" "}
          <Link to="/signup" className="text-teal-700 font-medium">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
