import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { ErrorBanner } from "../../components/ui";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("The two passwords don't match");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setDone(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-extrabold text-teal-900 mb-1">Choose a new password</h1>

        {!token ? (
          <div className="space-y-4 mt-3">
            <p className="text-sm text-alert">
              This reset link is incomplete. Open the link from your email again, or
              request a new one.
            </p>
            <Link to="/forgot-password" className="btn-primary w-full block text-center">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-4 mt-3">
            <p className="text-sm text-teal-900/70">
              Your password has been updated. You can now sign in with it.
            </p>
            <Link to="/login" className="btn-primary w-full block text-center">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-teal-900/60 mb-6">
              Use at least 8 characters.
            </p>
            <ErrorBanner message={error} />
            <div className="space-y-3">
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  autoComplete="new-password"
                />
              </div>
              <button className="btn-primary w-full" disabled={loading} onClick={submit}>
                {loading ? "Saving…" : "Update password"}
              </button>
            </div>
            {error?.includes("expired") && (
              <p className="text-sm text-center mt-4">
                <Link to="/forgot-password" className="text-teal-700 font-medium">
                  Request a new link
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
