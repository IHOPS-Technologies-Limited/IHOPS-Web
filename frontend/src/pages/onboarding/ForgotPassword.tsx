import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ErrorBanner } from "../../components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!email.trim()) return setError("Enter the email you sign in with");
    setLoading(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-extrabold text-teal-900 mb-1">Reset your password</h1>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-teal-900/70 mt-2">
              If an account exists for <strong>{email}</strong>, we've sent a link to
              reset the password. It works once and expires in 1 hour.
            </p>
            <p className="text-xs text-teal-900/50">
              Nothing in your inbox? Check spam, or ask your IHOPS contact to send
              you a reset link directly.
            </p>
            <Link to="/login" className="btn-primary w-full block text-center">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-teal-900/60 mb-6">
              Enter the email you use as hospital administrator and we'll send you
              a reset link.
            </p>
            <ErrorBanner message={error} />
            <div className="space-y-3">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  autoFocus
                />
              </div>
              <button className="btn-primary w-full" disabled={loading} onClick={submit}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </div>
            <p className="text-sm text-center text-teal-900/60 mt-6">
              <Link to="/login" className="text-teal-700 font-medium">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
